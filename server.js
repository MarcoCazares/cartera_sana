const express = require('express');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'app-data.json');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============ FUNCIONES DE DATOS ============

function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      settings: {
        monthlySavingsGoal: 5000,
        currency: 'MXN',
        ownerName: 'Marco'
      },
      accounts: [
        { id: '1', name: 'Efectivo', balance: 0, type: 'cash' },
        { id: '2', name: 'Tarjeta Débito', balance: 0, type: 'debit' },
        { id: '3', name: 'Ahorro', balance: 0, type: 'savings' }
      ],
      transactions: [],
      debts: [],
      plannedItems: [],
      budgets: {},
      savingsGoals: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function loadData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ FUNCIONES DE UTILIDAD ============

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(date);
}

function formatCurrency(value, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value || 0);
}

function getPlannedAmount(item) {
  const amount = Number(item.amount || 0);
  if (item.frequency === 'biweekly') {
    return amount * 2;
  }
  return amount;
}

// ============ FUNCIONES DE MÉTRICAS (CORREGIDA) ============

function calculateFinancialMetrics(data) {
  // Asegurar que data existe
  if (!data) {
    return {
      savingsRate: 0,
      debtToIncome: 0,
      emergencyFundMonths: 0,
      monthlySavings: 0,
      totalDebt: 0
    };
  }

  try {
    const monthKey = getMonthKey();
    const monthTransactions = (data.transactions || []).filter(t => t.date && t.date.startsWith(monthKey));
    
    const totalIncome = monthTransactions.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = monthTransactions.filter(t => t.type === 'expense' || t.type === 'debt_payment')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
    const savings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
    
    const totalDebt = (data.debts || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);
    const monthlyExpenses = (data.plannedItems || [])
      .filter(p => p.type === 'expense' && p.isActive !== false)
      .reduce((sum, p) => sum + (p.frequency === 'biweekly' ? Number(p.amount || 0) * 2 : Number(p.amount || 0)), 0);
    
    const emergencyFundMonths = monthlyExpenses > 0 ? (savings / monthlyExpenses) : 0;
    
    return {
      savingsRate: Math.max(0, savingsRate),
      debtToIncome: totalIncome > 0 ? (totalDebt / totalIncome) * 100 : 0,
      emergencyFundMonths: Math.max(0, emergencyFundMonths),
      monthlySavings: savings,
      totalDebt: totalDebt
    };
  } catch (error) {
    console.error('Error calculando métricas:', error);
    return {
      savingsRate: 0,
      debtToIncome: 0,
      emergencyFundMonths: 0,
      monthlySavings: 0,
      totalDebt: 0
    };
  }
}

// ============ FUNCIÓN PRINCIPAL DEL DASHBOARD (CORREGIDA) ============

function buildDashboardData(data) {
  // Asegurar que data existe y tiene todas las propiedades necesarias
  const safeData = {
    settings: data?.settings || { monthlySavingsGoal: 5000, currency: 'MXN', ownerName: 'Marco' },
    transactions: data?.transactions || [],
    debts: data?.debts || [],
    plannedItems: data?.plannedItems || [],
    budgets: data?.budgets || {},
    savingsGoals: data?.savingsGoals || [],
    accounts: data?.accounts || [
      { id: '1', name: 'Efectivo', balance: 0, type: 'cash' },
      { id: '2', name: 'Tarjeta Débito', balance: 0, type: 'debit' },
      { id: '3', name: 'Ahorro', balance: 0, type: 'savings' }
    ]
  };

  const monthKey = getMonthKey();
  const monthTransactions = safeData.transactions.filter((transaction) => transaction.date && transaction.date.startsWith(monthKey));

  const incomes = monthTransactions.filter((transaction) => transaction.type === 'income');
  const expenses = monthTransactions.filter((transaction) => transaction.type === 'expense');
  const debtPayments = monthTransactions.filter((transaction) => transaction.type === 'debt_payment');

  const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = [...expenses, ...debtPayments].reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = incomeTotal - expenseTotal;

  const plannedItems = (safeData.plannedItems || []).filter((item) => {
    if (item.isActive === false) {
      return false;
    }

    if (item.frequency === 'monthly' || item.frequency === 'biweekly') {
      return true;
    }

    if (item.frequency === 'once' && item.monthKey) {
      return item.monthKey === monthKey;
    }

    return true;
  });

  const plannedIncomeTotal = plannedItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + getPlannedAmount(item), 0);
  const plannedExpenseTotal = plannedItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + getPlannedAmount(item), 0);
  const plannedBalance = plannedIncomeTotal - plannedExpenseTotal;
  const projectedBalance = (incomeTotal + plannedIncomeTotal) - (expenseTotal + plannedExpenseTotal);
  const savingsGap = Number(safeData.settings.monthlySavingsGoal || 0) - Math.max(0, projectedBalance);

  const categoryBreakdown = Object.entries(
    monthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((acc, transaction) => {
        const category = transaction.category || 'General';
        acc[category] = (acc[category] || 0) + Number(transaction.amount || 0);
        return acc;
      }, {})
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const maxCategoryAmount = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map((item) => item.amount), 1) : 1;

  const debtTotal = safeData.debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0);
  const debtLimit = safeData.debts.reduce((sum, debt) => sum + Number(debt.limit || 0), 0);
  const debtUsage = debtLimit > 0 ? (debtTotal / debtLimit) * 100 : 0;

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const key = getMonthKey(date);
    const monthTransactionsForKey = safeData.transactions.filter((transaction) => transaction.date && transaction.date.startsWith(key));
    const monthIncome = monthTransactionsForKey.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthExpense = monthTransactionsForKey.filter((item) => item.type === 'expense' || item.type === 'debt_payment').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      key,
      label: new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(date),
      balance: monthIncome - monthExpense
    };
  }).reverse();

  // Calcular métricas (siempre devuelve un objeto válido)
  const metrics = calculateFinancialMetrics(safeData);

  return {
    monthKey,
    currentMonthLabel: getMonthLabel(),
    incomeTotal,
    expenseTotal,
    balance,
    plannedItems,
    plannedIncomeTotal,
    plannedExpenseTotal,
    plannedBalance,
    projectedBalance,
    savingsGap,
    categoryBreakdown,
    maxCategoryAmount,
    debtTotal,
    debtUsage,
    monthlyTrend,
    transactions: safeData.transactions.slice(0, 8),
    debts: safeData.debts,
    settings: safeData.settings,
    upcomingPlanned: plannedItems.slice(0, 5),
    metrics: metrics, // Siempre existe
    savingsGoals: safeData.savingsGoals || [],
    budgets: safeData.budgets || {},
    accounts: safeData.accounts || []
  };
}

// ============ RUTAS PRINCIPALES ============

app.get('/', (req, res) => {
  try {
    const data = loadData();
    const dashboard = buildDashboardData(data);
    const availableViews = ['overview', 'plan', 'movements', 'debts', 'goals', 'accounts'];
    const activeView = availableViews.includes(req.query.view) ? req.query.view : 'overview';

    res.render('index', {
      dashboard,
      formatCurrency,
      currency: data.settings?.currency || 'MXN',
      activeView
    });
  } catch (error) {
    console.error('Error en la ruta principal:', error);
    res.status(500).send('Error al cargar la página. Revisa la consola para más detalles.');
  }
});

// ============ RUTAS DE TRANSACCIONES ============

app.post('/transactions', (req, res) => {
  try {
    const data = loadData();
    const transaction = {
      id: Date.now().toString(),
      type: req.body.type || 'expense',
      description: req.body.description || 'Sin descripción',
      amount: Number(req.body.amount || 0),
      category: req.body.category || 'General',
      date: req.body.date || new Date().toISOString().slice(0, 10),
      paymentMethod: req.body.paymentMethod || 'Efectivo',
      notes: req.body.notes || '',
      linkedDebtId: req.body.linkedDebtId || null,
      accountId: req.body.accountId || '1'
    };

    // Actualizar balance de la cuenta
    const account = (data.accounts || []).find(a => a.id === transaction.accountId);
    if (account) {
      if (transaction.type === 'income') {
        account.balance = Number(account.balance || 0) + transaction.amount;
      } else {
        account.balance = Number(account.balance || 0) - transaction.amount;
      }
    }

    if (transaction.type === 'debt_payment' && transaction.linkedDebtId) {
      const debt = (data.debts || []).find((item) => item.id === transaction.linkedDebtId);
      if (debt) {
        debt.balance = Math.max(0, Number(debt.balance || 0) - transaction.amount);
      }
    }

    data.transactions = data.transactions || [];
    data.transactions.unshift(transaction);
    saveData(data);
    res.redirect('/?view=movements');
  } catch (error) {
    console.error('Error al crear transacción:', error);
    res.status(500).send('Error al guardar la transacción');
  }
});

app.put('/transactions/:id', (req, res) => {
  try {
    const data = loadData();
    data.transactions = data.transactions || [];
    const index = data.transactions.findIndex(t => t.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    // Revertir cambio de balance anterior
    const oldTransaction = data.transactions[index];
    const oldAccount = (data.accounts || []).find(a => a.id === oldTransaction.accountId);
    if (oldAccount) {
      if (oldTransaction.type === 'income') {
        oldAccount.balance = Number(oldAccount.balance || 0) - oldTransaction.amount;
      } else {
        oldAccount.balance = Number(oldAccount.balance || 0) + oldTransaction.amount;
      }
    }

    // Actualizar campos
    const newTransaction = {
      ...oldTransaction,
      type: req.body.type || oldTransaction.type,
      description: req.body.description || oldTransaction.description,
      amount: Number(req.body.amount || oldTransaction.amount),
      category: req.body.category || oldTransaction.category,
      date: req.body.date || oldTransaction.date,
      paymentMethod: req.body.paymentMethod || oldTransaction.paymentMethod,
      notes: req.body.notes || oldTransaction.notes
    };

    data.transactions[index] = newTransaction;

    // Aplicar nuevo cambio de balance
    const newAccount = (data.accounts || []).find(a => a.id === newTransaction.accountId);
    if (newAccount) {
      if (newTransaction.type === 'income') {
        newAccount.balance = Number(newAccount.balance || 0) + newTransaction.amount;
      } else {
        newAccount.balance = Number(newAccount.balance || 0) - newTransaction.amount;
      }
    }

    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar transacción:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/transactions/:id', (req, res) => {
  try {
    const data = loadData();
    data.transactions = data.transactions || [];
    const transaction = data.transactions.find(t => t.id === req.params.id);
    if (transaction) {
      // Revertir balance de cuenta
      const account = (data.accounts || []).find(a => a.id === transaction.accountId);
      if (account) {
        if (transaction.type === 'income') {
          account.balance = Number(account.balance || 0) - transaction.amount;
        } else {
          account.balance = Number(account.balance || 0) + transaction.amount;
        }
      }
    }
    data.transactions = data.transactions.filter(t => t.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE PLANIFICACIÓN ============

app.post('/planned', (req, res) => {
  try {
    const data = loadData();
    data.plannedItems = data.plannedItems || [];
    data.plannedItems.unshift({
      id: Date.now().toString(),
      type: req.body.type || 'expense',
      name: req.body.name || 'Nuevo plan',
      amount: Number(req.body.amount || 0),
      category: req.body.category || 'General',
      frequency: req.body.frequency || 'monthly',
      dueDay: Number(req.body.dueDay || 1),
      monthKey: req.body.monthKey || getMonthKey(),
      notes: req.body.notes || '',
      isActive: true
    });
    saveData(data);
    res.redirect('/?view=plan');
  } catch (error) {
    console.error('Error al crear plan:', error);
    res.status(500).send('Error al guardar el plan');
  }
});

app.put('/planned/:id', (req, res) => {
  try {
    const data = loadData();
    data.plannedItems = data.plannedItems || [];
    const index = data.plannedItems.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Elemento no encontrado' });
    }

    data.plannedItems[index] = {
      ...data.plannedItems[index],
      name: req.body.name || data.plannedItems[index].name,
      amount: Number(req.body.amount || data.plannedItems[index].amount),
      category: req.body.category || data.plannedItems[index].category,
      frequency: req.body.frequency || data.plannedItems[index].frequency,
      dueDay: Number(req.body.dueDay || data.plannedItems[index].dueDay),
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' : data.plannedItems[index].isActive
    };

    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/planned/:id', (req, res) => {
  try {
    const data = loadData();
    data.plannedItems = (data.plannedItems || []).filter(p => p.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar plan:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE DEUDAS ============

app.post('/debts', (req, res) => {
  try {
    const data = loadData();
    data.debts = data.debts || [];
    data.debts.unshift({
      id: Date.now().toString(),
      name: req.body.name || 'Nueva deuda',
      balance: Number(req.body.balance || 0),
      limit: Number(req.body.limit || 0),
      interestRate: Number(req.body.interestRate || 0),
      minPayment: Number(req.body.minPayment || 0),
      dueDate: req.body.dueDate || '',
      color: req.body.color || '#7c3aed'
    });
    saveData(data);
    res.redirect('/?view=debts');
  } catch (error) {
    console.error('Error al crear deuda:', error);
    res.status(500).send('Error al guardar la deuda');
  }
});

app.put('/debts/:id', (req, res) => {
  try {
    const data = loadData();
    data.debts = data.debts || [];
    const index = data.debts.findIndex(d => d.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }

    data.debts[index] = {
      ...data.debts[index],
      name: req.body.name || data.debts[index].name,
      balance: Number(req.body.balance || data.debts[index].balance),
      limit: Number(req.body.limit || data.debts[index].limit),
      interestRate: Number(req.body.interestRate || data.debts[index].interestRate),
      minPayment: Number(req.body.minPayment || data.debts[index].minPayment),
      dueDate: req.body.dueDate || data.debts[index].dueDate,
      color: req.body.color || data.debts[index].color
    };

    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar deuda:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/debts/:id', (req, res) => {
  try {
    const data = loadData();
    data.debts = (data.debts || []).filter(d => d.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar deuda:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE PRESUPUESTOS ============

app.post('/budgets', (req, res) => {
  try {
    const data = loadData();
    data.budgets = data.budgets || {};
    data.budgets[req.body.category] = Number(req.body.amount || 0);
    saveData(data);
    res.redirect('/?view=overview');
  } catch (error) {
    console.error('Error al crear presupuesto:', error);
    res.status(500).send('Error al guardar el presupuesto');
  }
});

app.delete('/budgets/:category', (req, res) => {
  try {
    const data = loadData();
    delete data.budgets[decodeURIComponent(req.params.category)];
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar presupuesto:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE METAS DE AHORRO ============

app.post('/savings-goals', (req, res) => {
  try {
    const data = loadData();
    data.savingsGoals = data.savingsGoals || [];
    data.savingsGoals.push({
      id: Date.now().toString(),
      name: req.body.name,
      targetAmount: Number(req.body.targetAmount || 0),
      currentAmount: Number(req.body.currentAmount || 0),
      deadline: req.body.deadline || '',
      priority: Number(req.body.priority || 1),
      monthlyContribution: Number(req.body.monthlyContribution || 0)
    });
    saveData(data);
    res.redirect('/?view=goals');
  } catch (error) {
    console.error('Error al crear meta:', error);
    res.status(500).send('Error al guardar la meta');
  }
});

app.put('/savings-goals/:id', (req, res) => {
  try {
    const data = loadData();
    data.savingsGoals = data.savingsGoals || [];
    const goal = data.savingsGoals.find(g => g.id === req.params.id);
    if (goal) {
      if (req.body.addAmount) {
        goal.currentAmount = Number(goal.currentAmount || 0) + Number(req.body.addAmount);
      } else {
        goal.currentAmount = Number(req.body.currentAmount || goal.currentAmount);
      }
      saveData(data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Meta no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar meta:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/savings-goals/:id', (req, res) => {
  try {
    const data = loadData();
    data.savingsGoals = (data.savingsGoals || []).filter(g => g.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar meta:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE CUENTAS ============

app.post('/accounts', (req, res) => {
  try {
    const data = loadData();
    data.accounts = data.accounts || [];
    data.accounts.push({
      id: Date.now().toString(),
      name: req.body.name,
      balance: Number(req.body.balance || 0),
      type: req.body.type || 'cash'
    });
    saveData(data);
    res.redirect('/?view=accounts');
  } catch (error) {
    console.error('Error al crear cuenta:', error);
    res.status(500).send('Error al guardar la cuenta');
  }
});

app.put('/accounts/:id', (req, res) => {
  try {
    const data = loadData();
    data.accounts = data.accounts || [];
    const account = data.accounts.find(a => a.id === req.params.id);
    if (account) {
      account.balance = Number(req.body.balance || account.balance);
      saveData(data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Cuenta no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar cuenta:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/accounts/:id', (req, res) => {
  try {
    const data = loadData();
    data.accounts = (data.accounts || []).filter(a => a.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============ RUTAS DE TRANSFERENCIAS ============

app.post('/transfers', (req, res) => {
  try {
    const data = loadData();
    data.accounts = data.accounts || [];
    data.transactions = data.transactions || [];
    const { fromAccount, toAccount, amount, description } = req.body;
    const amountNum = Number(amount);
    
    if (!fromAccount || !toAccount || !amountNum || amountNum <= 0) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }

    const fromAcc = data.accounts.find(a => a.id === fromAccount);
    const toAcc = data.accounts.find(a => a.id === toAccount);

    if (!fromAcc || !toAcc) {
      return res.status(400).json({ error: 'Cuentas no encontradas' });
    }

    if (Number(fromAcc.balance || 0) < amountNum) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Crear transacción de salida
    data.transactions.unshift({
      id: Date.now().toString(),
      type: 'transfer_out',
      description: `Transferencia a ${toAcc.name}: ${description || ''}`,
      amount: amountNum,
      date: new Date().toISOString().slice(0, 10),
      accountId: fromAccount,
      category: 'Transferencia',
      paymentMethod: 'Transferencia',
      notes: description || ''
    });

    // Crear transacción de entrada
    data.transactions.unshift({
      id: (Date.now() + 1).toString(),
      type: 'transfer_in',
      description: `Transferencia de ${fromAcc.name}: ${description || ''}`,
      amount: amountNum,
      date: new Date().toISOString().slice(0, 10),
      accountId: toAccount,
      category: 'Transferencia',
      paymentMethod: 'Transferencia',
      notes: description || ''
    });

    // Actualizar balances
    fromAcc.balance = Number(fromAcc.balance || 0) - amountNum;
    toAcc.balance = Number(toAcc.balance || 0) + amountNum;

    saveData(data);
    res.redirect('/?view=movements');
  } catch (error) {
    console.error('Error al realizar transferencia:', error);
    res.status(500).send('Error al realizar la transferencia');
  }
});

// ============ RUTAS DE CONFIGURACIÓN ============

app.post('/settings', (req, res) => {
  try {
    const data = loadData();
    data.settings = {
      ...data.settings,
      monthlySavingsGoal: Number(req.body.monthlySavingsGoal || 0),
      currency: req.body.currency || data.settings?.currency || 'MXN',
      ownerName: req.body.ownerName || data.settings?.ownerName || 'Marco'
    };
    saveData(data);
    res.redirect('/?view=overview');
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).send('Error al guardar la configuración');
  }
});

// ============ RUTAS DE EXPORTACIÓN ============

app.get('/api/export/excel', async (req, res) => {
  try {
    const data = loadData();
    const workbook = new ExcelJS.Workbook();
    
    // Hoja de transacciones
    const ws = workbook.addWorksheet('Movimientos');
    ws.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Tipo', key: 'type', width: 15 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Monto', key: 'amount', width: 15 },
      { header: 'Método', key: 'paymentMethod', width: 15 },
      { header: 'Cuenta', key: 'account', width: 20 }
    ];

    (data.transactions || []).forEach(t => {
      const account = (data.accounts || []).find(a => a.id === t.accountId);
      ws.addRow({
        date: t.date || '',
        type: t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Pago Deuda',
        description: t.description || '',
        category: t.category || '',
        amount: t.type === 'income' ? t.amount : -t.amount,
        paymentMethod: t.paymentMethod || '',
        account: account?.name || 'N/A'
      });
    });

    // Hoja de deudas
    const wsDebts = workbook.addWorksheet('Deudas');
    wsDebts.columns = [
      { header: 'Nombre', key: 'name', width: 20 },
      { header: 'Saldo', key: 'balance', width: 15 },
      { header: 'Límite', key: 'limit', width: 15 },
      { header: 'Pago Mínimo', key: 'minPayment', width: 15 },
      { header: 'Tasa Interés', key: 'interestRate', width: 15 }
    ];
    (data.debts || []).forEach(d => {
      wsDebts.addRow(d);
    });

    // Hoja de metas
    const wsGoals = workbook.addWorksheet('Metas');
    wsGoals.columns = [
      { header: 'Nombre', key: 'name', width: 20 },
      { header: 'Meta', key: 'targetAmount', width: 15 },
      { header: 'Progreso', key: 'currentAmount', width: 15 },
      { header: '% Completado', key: 'percent', width: 15 }
    ];
    (data.savingsGoals || []).forEach(g => {
      wsGoals.addRow({
        ...g,
        percent: g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) + '%' : '0%'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=finanzas-${new Date().toISOString().slice(0,10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportando Excel:', error);
    res.status(500).json({ error: 'Error al exportar' });
  }
});

app.get('/api/export/pdf', (req, res) => {
  try {
    const data = loadData();
    const dashboard = buildDashboardData(data);
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=resumen-${new Date().toISOString().slice(0,10)}.pdf`);
    
    doc.pipe(res);
    
    // Título
    doc.fontSize(24).text('Resumen Financiero', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generado: ${new Date().toLocaleString('es-MX')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Resumen
    doc.fontSize(16).text('Resumen del Mes', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Saldo: ${formatCurrency(dashboard.balance, data.settings?.currency || 'MXN')}`);
    doc.text(`Ingresos: ${formatCurrency(dashboard.incomeTotal, data.settings?.currency || 'MXN')}`);
    doc.text(`Gastos: ${formatCurrency(dashboard.expenseTotal, data.settings?.currency || 'MXN')}`);
    doc.text(`Meta de Ahorro: ${formatCurrency(dashboard.settings?.monthlySavingsGoal || 0, data.settings?.currency || 'MXN')}`);
    doc.moveDown();
    
    // Métricas
    doc.fontSize(16).text('Métricas Financieras', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Tasa de Ahorro: ${dashboard.metrics.savingsRate.toFixed(1)}%`);
    doc.text(`Deuda vs Ingresos: ${dashboard.metrics.debtToIncome.toFixed(1)}%`);
    doc.text(`Fondo de Emergencia: ${dashboard.metrics.emergencyFundMonths.toFixed(1)} meses`);
    doc.moveDown();
    
    // Gastos por categoría
    if (dashboard.categoryBreakdown.length > 0) {
      doc.fontSize(16).text('Gastos por Categoría', { underline: true });
      doc.moveDown();
      dashboard.categoryBreakdown.forEach(c => {
        doc.fontSize(12).text(`${c.category}: ${formatCurrency(c.amount, data.settings?.currency || 'MXN')}`);
      });
      doc.moveDown();
    }
    
    // Deudas
    if (data.debts && data.debts.length > 0) {
      doc.fontSize(16).text('Deudas Activas', { underline: true });
      doc.moveDown();
      data.debts.forEach(d => {
        doc.fontSize(12).text(`${d.name}: ${formatCurrency(d.balance, data.settings?.currency || 'MXN')}`);
      });
    }
    
    // Metas
    if (data.savingsGoals && data.savingsGoals.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Metas de Ahorro', { underline: true });
      doc.moveDown();
      data.savingsGoals.forEach(g => {
        const percent = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : '0';
        doc.fontSize(12).text(`${g.name}: ${formatCurrency(g.currentAmount, data.settings?.currency || 'MXN')} / ${formatCurrency(g.targetAmount, data.settings?.currency || 'MXN')} (${percent}%)`);
        if (g.deadline) {
          doc.text(`  Fecha límite: ${new Date(g.deadline).toLocaleDateString('es-MX')}`);
        }
        doc.moveDown(0.5);
      });
    }
    
    doc.end();
  } catch (error) {
    console.error('Error exportando PDF:', error);
    res.status(500).json({ error: 'Error al exportar' });
  }
});


// ============ CALCULADORA DE METAS ============

app.post('/api/calculate-goal', (req, res) => {
  try {
    const { targetAmount, currentAmount, deadline, frequency } = req.body;
    
    const target = Number(targetAmount || 0);
    const current = Number(currentAmount || 0);
    const remaining = target - current;
    
    let monthlyContribution = 0;
    let biweeklyContribution = 0;
    let weeklyContribution = 0;
    let dailyContribution = 0;
    let months = 0;
    let totalWeeks = 0;
    let totalDays = 0;
    
    if (deadline) {
      const today = new Date();
      const deadlineDate = new Date(deadline);
      const diffTime = Math.abs(deadlineDate - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      months = Math.ceil(diffDays / 30.44);
      totalWeeks = Math.ceil(diffDays / 7);
      totalDays = diffDays;
      
      if (months > 0) {
        monthlyContribution = remaining / months;
        biweeklyContribution = remaining / (totalWeeks / 2);
        weeklyContribution = remaining / totalWeeks;
        dailyContribution = remaining / totalDays;
      }
    }
    
    res.json({
      success: true,
      data: {
        target,
        current,
        remaining,
        months,
        totalWeeks,
        totalDays,
        monthlyContribution: Math.ceil(monthlyContribution * 100) / 100,
        biweeklyContribution: Math.ceil(biweeklyContribution * 100) / 100,
        weeklyContribution: Math.ceil(weeklyContribution * 100) / 100,
        dailyContribution: Math.ceil(dailyContribution * 100) / 100,
        progress: target > 0 ? (current / target) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Error calculando meta:', error);
    res.status(500).json({ error: 'Error al calcular' });
  }
});

// ============ INICIO DEL SERVIDOR ============

app.listen(PORT, () => {
  console.log(`✨ Cartera Sana corriendo en http://localhost:${PORT}`);
  console.log(`📊 Datos guardados en: ${DATA_FILE}`);
});