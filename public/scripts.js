// ============ ICONOS LUCIDE ============
// Lucide ya se carga globalmente desde /vendor/lucide/dist/umd/lucide.js
// (agregado en el <head> del HTML)
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', refreshIcons);

// ============ TOASTS Y SWEETALERT2 ============

function showToast(message, type = 'info') {
  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: type,
      title: message,
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  }
}

function confirmAction(message, callback) {
  if (!window.Swal) return callback();

  Swal.fire({
    title: '¿Estás seguro?',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0d6efd',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      callback();
    }
  });
}

// ============ ELIMINAR ============

// Eliminar transacción
document.querySelectorAll('.btn-delete[data-type="transaction"]').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    confirmAction('¿Estás seguro de eliminar este movimiento?', async () => {
      const response = await fetch(`/transactions/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Movimiento eliminado', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar el movimiento', 'error');
      }
    });
  });
});

// Eliminar plan
document.querySelectorAll('.btn-delete-plan').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    confirmAction('¿Estás seguro de eliminar este elemento planeado?', async () => {
      const response = await fetch(`/planned/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Elemento planeado eliminado', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar el elemento', 'error');
      }
    });
  });
});

// Eliminar deuda
document.querySelectorAll('.btn-delete-debt').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    confirmAction('¿Estás seguro de eliminar esta deuda?', async () => {
      const response = await fetch(`/debts/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Deuda eliminada', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar la deuda', 'error');
      }
    });
  });
});

// Eliminar meta
document.querySelectorAll('.btn-delete-goal').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    confirmAction('¿Estás seguro de eliminar esta meta?', async () => {
      const response = await fetch(`/savings-goals/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Meta eliminada', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar la meta', 'error');
      }
    });
  });
});

// Eliminar cuenta
document.querySelectorAll('.btn-delete-account').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    confirmAction('¿Estás seguro de eliminar esta cuenta?', async () => {
      const response = await fetch(`/accounts/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Cuenta eliminada', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar la cuenta', 'error');
      }
    });
  });
});

// Eliminar presupuesto
document.querySelectorAll('.btn-delete-budget').forEach(btn => {
  btn.addEventListener('click', function() {
    const category = this.dataset.category;
    confirmAction(`¿Eliminar presupuesto para "${category}"?`, async () => {
      const response = await fetch(`/budgets/${encodeURIComponent(category)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showToast('Presupuesto eliminado', 'success');
        location.reload();
      } else {
        showToast('No se pudo eliminar el presupuesto', 'error');
      }
    });
  });
});

// ============ EDITAR ============

// Editar transacción
document.querySelectorAll('.btn-edit[data-type="transaction"]').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    const item = this.closest('.transaction-item');
    const description = item.querySelector('strong').textContent;
    const amountText = item.querySelector('.amount').textContent;
    const amount = Math.abs(parseFloat(amountText.replace(/[^0-9.-]+/g, '')));
    const type = item.querySelector('.amount').classList.contains('positive') ? 'income' : 'expense';
    const date = item.querySelector('.muted').textContent.split('·')[1]?.trim() || '';
    const category = item.querySelector('.muted').textContent.split('·')[0]?.trim() || '';
    
    openEditModal('transaction', {
      id,
      description,
      amount,
      type,
      date,
      category
    });
  });
});

// Editar plan
document.querySelectorAll('.btn-edit-plan').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    const item = this.closest('.plan-item');
    const name = item.querySelector('strong').textContent;
    const amountText = item.querySelector('.tag').textContent;
    const amount = parseFloat(amountText.replace(/[^0-9.-]+/g, ''));
    const frequencyText = item.querySelector('.muted').textContent;
    let frequency = 'monthly';
    if (frequencyText.includes('Quincenal')) frequency = 'biweekly';
    if (frequencyText.includes('Una vez')) frequency = 'once';
    const dueDay = frequencyText.match(/día (\d+)/)?.[1] || '1';
    const category = frequencyText.split('·')[0]?.trim() || '';
    const type = item.querySelector('.tag').classList.contains('positive') ? 'income' : 'expense';
    
    openEditModal('planned', {
      id,
      name,
      amount,
      type,
      category,
      frequency,
      dueDay
    });
  });
});

// Editar deuda
document.querySelectorAll('.btn-edit-debt').forEach(btn => {
  btn.addEventListener('click', function() {
    const id = this.dataset.id;
    const item = this.closest('.debt-item');
    const name = item.querySelector('strong').textContent;
    const balanceText = item.querySelector('.debt-head span').textContent;
    const balance = parseFloat(balanceText.replace(/[^0-9.-]+/g, ''));
    const infoText = item.querySelector('.muted').textContent;
    const limit = parseFloat(infoText.match(/Límite ([0-9,]+)/)?.[1]?.replace(/,/g, '') || '0');
    const minPayment = parseFloat(infoText.match(/Pago mínimo ([0-9,]+)/)?.[1]?.replace(/,/g, '') || '0');
    const color = item.querySelector('.progress-fill')?.style?.background || '#7c3aed';
    
    openEditModal('debt', {
      id,
      name,
      balance,
      limit,
      minPayment,
      color
    });
  });
});

// ============ MODAL ============

function openEditModal(type, data) {
  const modal = document.getElementById('editModal');
  const title = document.getElementById('modalTitle');
  const fields = document.getElementById('editFields');
  
  document.getElementById('editId').value = data.id;
  document.getElementById('editType').value = type;
  
  let html = '';
  
  if (type === 'transaction') {
    title.textContent = 'Editar Movimiento';
    html = `
      <div class="form-row">
        <label>
          Tipo
          <select name="type">
            <option value="income" ${data.type === 'income' ? 'selected' : ''}>Ingreso</option>
            <option value="expense" ${data.type === 'expense' ? 'selected' : ''}>Gasto</option>
            <option value="debt_payment" ${data.type === 'debt_payment' ? 'selected' : ''}>Pago de deuda</option>
          </select>
        </label>
        <label>
          Monto
          <input type="number" step="0.01" name="amount" value="${data.amount}" required />
        </label>
      </div>
      <div class="form-row">
        <label>
          Descripción
          <input type="text" name="description" value="${data.description}" required />
        </label>
        <label>
          Categoría
          <input type="text" name="category" value="${data.category}" />
        </label>
      </div>
      <div class="form-row">
        <label>
          Fecha
          <input type="date" name="date" value="${data.date}" />
        </label>
        <label>
          Método
          <input type="text" name="paymentMethod" placeholder="Efectivo / TDC / Transferencia" />
        </label>
      </div>
    `;
  } else if (type === 'planned') {
    title.textContent = 'Editar Planificación';
    html = `
      <div class="form-row">
        <label>
          Tipo
          <select name="type">
            <option value="income" ${data.type === 'income' ? 'selected' : ''}>Ingreso</option>
            <option value="expense" ${data.type === 'expense' ? 'selected' : ''}>Gasto</option>
          </select>
        </label>
        <label>
          Nombre
          <input type="text" name="name" value="${data.name}" required />
        </label>
      </div>
      <div class="form-row">
        <label>
          Monto
          <input type="number" step="0.01" name="amount" value="${data.amount}" required />
        </label>
        <label>
          Categoría
          <input type="text" name="category" value="${data.category}" />
        </label>
      </div>
      <div class="form-row">
        <label>
          Frecuencia
          <select name="frequency">
            <option value="monthly" ${data.frequency === 'monthly' ? 'selected' : ''}>Mensual</option>
            <option value="biweekly" ${data.frequency === 'biweekly' ? 'selected' : ''}>Quincenal</option>
            <option value="once" ${data.frequency === 'once' ? 'selected' : ''}>Una sola vez</option>
          </select>
        </label>
        <label>
          Día
          <input type="number" min="1" max="31" name="dueDay" value="${data.dueDay}" />
        </label>
      </div>
    `;
  } else if (type === 'debt') {
    title.textContent = 'Editar Deuda';
    html = `
      <div class="form-row">
        <label>
          Nombre
          <input type="text" name="name" value="${data.name}" required />
        </label>
        <label>
          Saldo
          <input type="number" step="0.01" name="balance" value="${data.balance}" required />
        </label>
      </div>
      <div class="form-row">
        <label>
          Límite
          <input type="number" step="0.01" name="limit" value="${data.limit}" />
        </label>
        <label>
          Pago mínimo
          <input type="number" step="0.01" name="minPayment" value="${data.minPayment}" />
        </label>
      </div>
      <label>
        Color
        <input type="color" name="color" value="${data.color}" />
      </label>
    `;
  }
  
  fields.innerHTML = html;
  modal.classList.remove('hidden');
  modal.classList.add('show');
  modal.style.display = 'block';

   refreshIcons();  
}

function closeModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Cerrar modal con click fuera
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeModal();
  }
});

// ============ ENVIAR EDICIÓN ============

async function submitEdit() {
  const id = document.getElementById('editId').value;
  const type = document.getElementById('editType').value;
  const form = document.getElementById('editForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  let endpoint = '';
  if (type === 'transaction') endpoint = `/transactions/${id}`;
  else if (type === 'planned') endpoint = `/planned/${id}`;
  else if (type === 'debt') endpoint = `/debts/${id}`;

  confirmAction('¿Guardar los cambios realizados?', async () => {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showToast('Actualizado correctamente', 'success');
      location.reload();
    } else {
      showToast('Error al actualizar', 'error');
    }
  });
}

// ============ APORTAR A META ============

document.querySelectorAll('.btn-add-goal').forEach(btn => {
  btn.addEventListener('click', async function() {
    const id = this.dataset.id;
    const input = this.closest('.inline-form').querySelector('.goal-contribution');
    const amount = input.value;
    
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }
    
    const response = await fetch(`/savings-goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addAmount: parseFloat(amount) })
    });
    
    if (response.ok) {
      showToast('Aportación registrada', 'success');
      location.reload();
    } else {
      showToast('Error al agregar aportación', 'error');
    }
  });
});

// ============ TECLADO ============

// Enter en los inputs de aportación
document.querySelectorAll('.goal-contribution').forEach(input => {
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const btn = this.closest('.inline-form').querySelector('.btn-add-goal');
      btn.click();
    }
  });
});

// ============ FILTROS (opcional) ============

// Puedes agregar un formulario de filtros en la vista de movimientos
// y usar este código para aplicarlos

document.addEventListener('DOMContentLoaded', function() {
  // Inicializar fecha en los inputs de fecha
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().slice(0, 10);
  dateInputs.forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });

  document.querySelectorAll('.progress-fill[data-progress]').forEach((bar) => {
    const value = Number(bar.dataset.progress || 0);
    bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    if (bar.dataset.color) {
      bar.style.background = bar.dataset.color;
    }
  });
});



// ============ TABLA DE AMORTIZACIÓN ============

async function calculateAmortization() {
  const balance = document.getElementById('amortBalance').value;
  const rate = document.getElementById('amortRate').value;
  const minPayment = document.getElementById('amortMinPayment').value;
  const extraPayment = document.getElementById('amortExtraPayment').value || 0;
  
  if (!balance || !rate || !minPayment) {
    showToast('Por favor, completa todos los campos requeridos', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/amortization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        balance, 
        interestRate: rate, 
        minPayment, 
        extraPayment: parseFloat(extraPayment) || 0 
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      
      // Mostrar resultados
      document.getElementById('amortMonthsSaved').textContent = data.comparison.monthsSaved;
      document.getElementById('amortInterestSaved').textContent = formatCurrency(data.comparison.interestSaved);
      document.getElementById('amortTotalInterest').textContent = formatCurrency(data.comparison.totalInterest.minPayment);
      
      // Mostrar comparación
      const comparisonDiv = document.getElementById('amortComparison');
      const monthsSaved = data.comparison.monthsSaved;
      const interestSaved = data.comparison.interestSaved;
      
      if (monthsSaved > 0 || interestSaved > 0) {
        comparisonDiv.className = 'comparison-highlight';
        comparisonDiv.innerHTML = `
          <strong>✅ ¡Excelente decisión!</strong><br>
          Pagando <strong>extra</strong>:
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Terminarás <strong>${monthsSaved} meses antes</strong></li>
            <li>Ahorrarás <strong>${formatCurrency(interestSaved)}</strong> en intereses</li>
          </ul>
        `;
      } else {
        comparisonDiv.className = 'comparison-highlight negative';
        comparisonDiv.innerHTML = `
          <strong>⚠️ Considera aumentar tu pago</strong><br>
          Con el pago mínimo actual, pagarás más intereses.
        `;
      }
      
      // Mostrar tabla
      let scheduleHTML = `
        <table class="amortization-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Pago Mínimo</th>
              <th>Interés</th>
              <th>Saldo Restante</th>
              <th>Pago Extra</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      // Combinar ambas estrategias para comparación
      data.strategy1.schedule.forEach((row, index) => {
        const extraRow = data.strategy2.schedule[index] || { payment: 0, interest: 0, remaining: 0 };
        scheduleHTML += `
          <tr>
            <td>${row.month}</td>
            <td>${formatCurrency(row.payment)}</td>
            <td>${formatCurrency(row.interest)}</td>
            <td>${formatCurrency(row.remaining)}</td>
            <td>${extraRow.payment > 0 ? formatCurrency(extraRow.payment - row.payment) : '$0'}</td>
          </tr>
        `;
      });
      
      scheduleHTML += `</tbody></table>`;
      document.getElementById('amortScheduleContainer').innerHTML = scheduleHTML;
      
      document.getElementById('amortResults').style.display = 'block';
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al calcular. Revisa la consola.', 'error');
  }
}