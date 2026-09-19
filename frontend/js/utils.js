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

/**
 * Component Error Boundary (Fault Isolation System)
 * Prevents an unhandled runtime error in one view from crashing adjacent views.
 */
function safeComponentRender(componentName, renderFn, fallbackContainerId = null) {
  try {
    renderFn();
  } catch (err) {
    console.error(`[Error Boundary] Component "${componentName}" caught an isolated error:`, err);
    if (fallbackContainerId) {
      const container = document.getElementById(fallbackContainerId);
      if (container) {
        const isTable = container.tagName.toLowerCase() === 'tbody';
        if (isTable) {
          container.innerHTML = `
            <tr>
              <td colspan="10" style="padding: 2rem; text-align: center;">
                <div class="component-error-box">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: var(--color-warning); flex-shrink: 0;"></i>
                    <div style="text-align: left;">
                      <strong style="display: block; font-size: 0.85rem;">Temporary issue displaying ${escapeHtmlText(componentName)}</strong>
                      <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                        An isolated error occurred in this view. All other platform features are operating normally.
                      </p>
                    </div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="retryComponentRender('${escapeHtmlText(componentName)}', '${fallbackContainerId}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; white-space: nowrap;">
                    <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Retry View
                  </button>
                </div>
              </td>
            </tr>
          `;
        } else {
          container.innerHTML = `
            <div class="component-error-box">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: var(--color-warning); flex-shrink: 0;"></i>
                <div style="text-align: left;">
                  <strong style="display: block; font-size: 0.85rem;">Temporary issue displaying ${escapeHtmlText(componentName)}</strong>
                  <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                    An isolated error occurred in this view. All other platform features are operating normally.
                  </p>
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="retryComponentRender('${escapeHtmlText(componentName)}', '${fallbackContainerId}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; white-space: nowrap;">
                <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Retry View
              </button>
            </div>
          `;
        }
        if (window.lucide) lucide.createIcons();
      }
    }
  }
}
window.safeComponentRender = safeComponentRender;

function retryComponentRender(componentName, containerId) {
  if (typeof refreshData === 'function') {
    refreshData();
  }
}
window.retryComponentRender = retryComponentRender;

