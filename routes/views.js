const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, '..', 'data', 'app-data.json');

// Modificar ensureDataFile para incluir budgets
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
        ownerName: 'Tu nombre'
      },
      transactions: [],
      debts: [],
      plannedItems: [],
      budgets: {} // Nuevo: { 'Alimentación': 3000, 'Transporte': 1500 }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// Agregar endpoints para budgets
app.post('/budgets', (req, res) => {
  const data = loadData();
  data.budgets = data.budgets || {};
  data.budgets[req.body.category] = Number(req.body.amount || 0);
  saveData(data);
  res.redirect('/?view=overview');
});

app.delete('/budgets/:category', (req, res) => {
  const data = loadData();
  delete data.budgets[req.params.category];
  saveData(data);
  res.json({ success: true });
});

function loadData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

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

function buildDashboardData(data) {
  const monthKey = getMonthKey();
  const monthTransactions = data.transactions.filter((transaction) => transaction.date.startsWith(monthKey));

  const incomes = monthTransactions.filter((transaction) => transaction.type === 'income');
  const expenses = monthTransactions.filter((transaction) => transaction.type === 'expense');
  const debtPayments = monthTransactions.filter((transaction) => transaction.type === 'debt_payment');

  const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = [...expenses, ...debtPayments].reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = incomeTotal - expenseTotal;

  const plannedItems = (data.plannedItems || []).filter((item) => {
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
  const savingsGap = Number(data.settings.monthlySavingsGoal || 0) - Math.max(0, projectedBalance);

  const categoryBreakdown = Object.entries(
    monthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((acc, transaction) => {
        acc[transaction.category || 'General'] = (acc[transaction.category || 'General'] || 0) + Number(transaction.amount || 0);
        return acc;
      }, {})
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const maxCategoryAmount = Math.max(...categoryBreakdown.map((item) => item.amount), 1);
  const debtTotal = data.debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0);
  const debtLimit = data.debts.reduce((sum, debt) => sum + Number(debt.limit || 0), 0);
  const debtUsage = debtLimit > 0 ? (debtTotal / debtLimit) * 100 : 0;

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const key = getMonthKey(date);
    const monthTransactionsForKey = data.transactions.filter((transaction) => transaction.date.startsWith(key));
    const monthIncome = monthTransactionsForKey.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthExpense = monthTransactionsForKey.filter((item) => item.type === 'expense' || item.type === 'debt_payment').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      key,
      label: new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(date),
      balance: monthIncome - monthExpense
    };
  }).reverse();

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
    transactions: data.transactions.slice(0, 8),
    debts: data.debts,
    settings: data.settings,
    upcomingPlanned: plannedItems.slice(0, 5)
  };
}

router.get('/', (req, res) => {
  const data = loadData();
  const dashboard = buildDashboardData(data);
  const availableViews = ['overview', 'plan', 'movements', 'debts'];
  const activeView = availableViews.includes(req.query.view) ? req.query.view : 'overview';

  res.render('index', {
    dashboard,
    formatCurrency,
    currency: data.settings.currency || 'MXN',
    activeView
  });
});

module.exports = router;
