let resumeAfterModal = false;
let uiRef = null;

export function initDialogService(ui) {
  uiRef = ui;
}

function setModalOpen(open) {
  const main = document.getElementById('main');
  if (!main) return;

  if (open) {
    main.classList.add('modal_open');
    if (uiRef?.game && !uiRef.game.paused) {
      resumeAfterModal = true;
      window.pause?.();
    } else {
      resumeAfterModal = false;
    }
  } else {
    main.classList.remove('modal_open');
    if (resumeAfterModal && uiRef?.game?.paused) {
      window.unpause?.();
    }
    resumeAfterModal = false;
  }
}

function bindDialog(dialog, resolve) {
  const onClose = () => {
    dialog.removeEventListener('close', onClose);
    setModalOpen(false);
    resolve(dialog.returnValue === 'confirm');
  };
  dialog.addEventListener('close', onClose);
}

export function blockGameForModal() {
  setModalOpen(true);
}

export function unblockGameForModal() {
  setModalOpen(false);
}

export function confirmDialog(message, { title = 'Confirm', confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  const dialog = document.getElementById('confirm_dialog');
  const titleEl = document.getElementById('confirm_dialog_title');
  const messageEl = document.getElementById('confirm_dialog_message');
  const confirmBtn = document.getElementById('confirm_dialog_ok');
  const cancelBtn = document.getElementById('confirm_dialog_cancel');

  if (!dialog || !messageEl) {
    return Promise.resolve(window.confirm(message));
  }

  if (titleEl) titleEl.textContent = title;
  messageEl.textContent = message;
  if (confirmBtn) confirmBtn.textContent = confirmLabel;
  if (cancelBtn) cancelBtn.textContent = cancelLabel;

  return new Promise((resolve) => {
    bindDialog(dialog, resolve);
    setModalOpen(true);
    dialog.returnValue = 'cancel';
    dialog.showModal();
    confirmBtn?.focus();
  });
}

export function alertDialog(message, { title = 'Notice' } = {}) {
  const dialog = document.getElementById('alert_dialog');
  const titleEl = document.getElementById('alert_dialog_title');
  const messageEl = document.getElementById('alert_dialog_message');

  if (!dialog || !messageEl) {
    window.alert(message);
    return Promise.resolve();
  }

  if (titleEl) titleEl.textContent = title;
  messageEl.textContent = message;

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      setModalOpen(false);
      resolve();
    };
    dialog.addEventListener('close', onClose);
    setModalOpen(true);
    dialog.showModal();
    document.getElementById('alert_dialog_ok')?.focus();
  });
}
