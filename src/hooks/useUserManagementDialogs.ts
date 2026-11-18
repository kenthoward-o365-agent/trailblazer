import { useState, useCallback } from "react";
import type { AppRole } from "./useUserManagement";

export interface RoleChangeDialogState {
  open: boolean;
  userId: string;
  newRole: AppRole;
  userName: string;
}

export interface DeleteAccessDialogState {
  open: boolean;
  accessId: string;
  userName: string;
}

export interface DeleteUserDialogState {
  open: boolean;
  userId: string;
  userName: string;
}

export interface EditUserDialogState {
  open: boolean;
  user: { userId: string; firstName: string; lastName: string; phone?: string | null } | null;
}


export function useUserManagementDialogs() {
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<RoleChangeDialogState | null>(null);
  const [deleteAccessDialog, setDeleteAccessDialog] = useState<DeleteAccessDialogState | null>(null);
  const [deleteUserDialog, setDeleteUserDialog] = useState<DeleteUserDialogState | null>(null);
  const [editUserDialog, setEditUserDialog] = useState<EditUserDialogState>({ open: false, user: null });

  const openRoleChangeDialog = useCallback((userId: string, userName: string, newRole: AppRole) => {
    setConfirmDialog({ open: true, userId, newRole, userName });
  }, []);

  const closeRoleChangeDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const openDeleteAccessDialog = useCallback((accessId: string, userName: string) => {
    setDeleteAccessDialog({ open: true, accessId, userName });
  }, []);

  const closeDeleteAccessDialog = useCallback(() => {
    setDeleteAccessDialog(null);
  }, []);

  const openDeleteUserDialog = useCallback((userId: string, userName: string) => {
    setDeleteUserDialog({ open: true, userId, userName });
  }, []);

  const closeDeleteUserDialog = useCallback(() => {
    setDeleteUserDialog(null);
  }, []);

  const openEditUserDialog = useCallback((user: { userId: string; firstName: string; lastName: string; phone?: string | null }) => {
    setEditUserDialog({ open: true, user });
  }, []);


  const closeEditUserDialog = useCallback(() => {
    setEditUserDialog({ open: false, user: null });
  }, []);

  return {
    addUserDialogOpen,
    setAddUserDialogOpen,
    confirmDialog,
    openRoleChangeDialog,
    closeRoleChangeDialog,
    deleteAccessDialog,
    openDeleteAccessDialog,
    closeDeleteAccessDialog,
    deleteUserDialog,
    openDeleteUserDialog,
    closeDeleteUserDialog,
    editUserDialog,
    openEditUserDialog,
    closeEditUserDialog,
  };
}
