/**
 * Universal HTML Sanitization Helper
 */
function escapeHtmlText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtmlText = escapeHtmlText;

/**
 * Toast Notification System
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  
  if (!toast || !toastMsg) return;
  
  toastMsg.innerText = message;
  toast.className = 'toast';
  if (type === 'danger') {
    toast.style.borderColor = 'var(--color-danger)';
  } else {
    toast.style.borderColor = 'var(--color-primary)';
  }
  
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
window.showToast = showToast;

/**
 * Custom Confirmation Modal
 */
function showConfirmModal(title, message, isDestructive = false) {
  return new Promise((resolve) => {
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const iconWrapper = document.getElementById('confirm-icon-wrapper');
    const modalConfirm = document.getElementById('modal-confirm');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    
    if (isDestructive) {
      btnOk.className = 'btn btn-primary destructive';
      btnOk.style.background = '#ef4444';
      btnOk.style.borderColor = '#ef4444';
      if (iconWrapper) {
        iconWrapper.className = 'confirm-icon-wrapper';
        iconWrapper.innerHTML = '<i data-lucide="alert-triangle"></i>';
      }
    } else {
      btnOk.className = 'btn btn-primary primary';
      btnOk.style.background = '#0ea5e9';
      btnOk.style.borderColor = '#0ea5e9';
      if (iconWrapper) {
        iconWrapper.className = 'confirm-icon-wrapper primary';
        iconWrapper.innerHTML = '<i data-lucide="help-circle"></i>';
      }
    }

    if (window.lucide) {
      lucide.createIcons();
    }

    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      if (modalConfirm) modalConfirm.removeEventListener('click', onBackdrop);
      closeModal('modal-confirm');
      resolve(result);
    };

    const newBtnOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    newBtnOk.addEventListener('click', () => finish(true));
    
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    newBtnCancel.addEventListener('click', () => finish(false));

    const onBackdrop = (e) => {
      if (e.target === modalConfirm) {
        modalConfirm.removeEventListener('click', onBackdrop);
        finish(false);
      }
    };
    modalConfirm.addEventListener('click', onBackdrop);

    openModal('modal-confirm');
  });
}
window.showConfirmModal = showConfirmModal;

/**
 * Form Sanitization & Reset Helper
 */
function clearModalForm(modalOrId) {
  const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
  if (!modal) return;
  const form = modal.querySelector('form');
  if (form) {
    form.reset();
    form.querySelectorAll('input, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = el.defaultChecked || false;
      } else if (el.type !== 'submit' && el.type !== 'button' && el.type !== 'hidden') {
        el.value = '';
        el.removeAttribute('value');
      }
    });
    form.querySelectorAll('select').forEach(el => {
      el.selectedIndex = 0;
    });
  }
}
window.clearModalForm = clearModalForm;

/**
 * Modal Open / Close Helpers
 */
function openModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  const actualId = modal.id || modalId;

  if (actualId === 'modal-add-gear' || actualId === 'modal-add-client' || actualId === 'modal-add-user' || actualId === 'modal-checkout') {
    clearModalForm(modal);
  }

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}
window.openModal = openModal;

function closeModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  const actualId = modal.id || modalId;
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    if (actualId === 'modal-add-gear' || actualId === 'modal-add-client' || actualId === 'modal-add-user' || actualId === 'modal-checkout') {
      clearModalForm(modal);
    }
  }, 300);
}
window.closeModal = closeModal;
