import { useCallback, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({ message, resolve, ...options });
    });
  }, []);

  function handleConfirm() {
    state?.resolve(true);
    setState(null);
  }

  function handleCancel() {
    state?.resolve(false);
    setState(null);
  }

  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      danger={state?.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog };
}
