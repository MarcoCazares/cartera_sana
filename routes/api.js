const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, '..', 'data', 'app-data.json');

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
      plannedItems: []
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

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

router.post('/transactions', (req, res) => {
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
    linkedDebtId: req.body.linkedDebtId || null
  };

  if (transaction.type === 'debt_payment' && transaction.linkedDebtId) {
    const debt = data.debts.find((item) => item.id === transaction.linkedDebtId);
    if (debt) {
      debt.balance = Math.max(0, Number(debt.balance || 0) - transaction.amount);
    }
  }

  data.transactions.unshift(transaction);
  saveData(data);
  res.redirect('/?view=movements');
});

router.put('/transactions/:id', (req, res) => {
  const data = loadData();
  const index = data.transactions.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  data.transactions[index] = {
    ...data.transactions[index],
    type: req.body.type || data.transactions[index].type,
    description: req.body.description || data.transactions[index].description,
    amount: Number(req.body.amount || data.transactions[index].amount),
    category: req.body.category || data.transactions[index].category,
    date: req.body.date || data.transactions[index].date,
    paymentMethod: req.body.paymentMethod || data.transactions[index].paymentMethod,
    notes: req.body.notes || data.transactions[index].notes
  };

  saveData(data);
  res.json({ success: true });
});

router.delete('/transactions/:id', (req, res) => {
  const data = loadData();
  data.transactions = data.transactions.filter((item) => item.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

router.post('/planned', (req, res) => {
  const data = loadData();
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
});

router.put('/planned/:id', (req, res) => {
  const data = loadData();
  const index = data.plannedItems.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Elemento planeado no encontrado' });
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
});

router.delete('/planned/:id', (req, res) => {
  const data = loadData();
  data.plannedItems = data.plannedItems.filter((item) => item.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

router.post('/debts', (req, res) => {
  const data = loadData();
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
});

router.put('/debts/:id', (req, res) => {
  const data = loadData();
  const index = data.debts.findIndex((item) => item.id === req.params.id);
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
});

router.delete('/debts/:id', (req, res) => {
  const data = loadData();
  data.debts = data.debts.filter((item) => item.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

router.post('/settings', (req, res) => {
  const data = loadData();
  data.settings = {
    ...data.settings,
    monthlySavingsGoal: Number(req.body.monthlySavingsGoal || 0),
    currency: req.body.currency || data.settings.currency || 'MXN',
    ownerName: req.body.ownerName || data.settings.ownerName || 'Tu nombre'
  };
  saveData(data);
  res.redirect('/?view=overview');
});

module.exports = router;
