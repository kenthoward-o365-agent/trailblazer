import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransferPostingParams {
  sourcePostingId: string;
  sourceLedgerAccountId: string;
  destinationLedgerAccountId: string;
  amount: number; // For partial transfers
  transferNote?: string;
  auditDate: string;
}

interface TransferResult {
  success: boolean;
  newPostingId?: string;
  error?: string;
}

export const useFolioTransfer = () => {
  const [isTransferring, setIsTransferring] = useState(false);

  const transferPosting = async (params: TransferPostingParams): Promise<TransferResult> => {
    const {
      sourcePostingId,
      sourceLedgerAccountId,
      destinationLedgerAccountId,
      amount,
      transferNote,
      auditDate,
    } = params;

    if (sourceLedgerAccountId === destinationLedgerAccountId) {
      return { success: false, error: "Cannot transfer to the same folio" };
    }

    if (amount <= 0) {
      return { success: false, error: "Transfer amount must be positive" };
    }

    setIsTransferring(true);

    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Get the source posting details
      const { data: sourcePosting, error: fetchError } = await supabase
        .from("folio_postings")
        .select("*")
        .eq("id", sourcePostingId)
        .single();

      if (fetchError || !sourcePosting) {
        throw new Error("Source posting not found");
      }

      // Verify the amount doesn't exceed the original posting
      const originalAmount = sourcePosting.debit_amount || Math.abs(sourcePosting.amount || 0);
      if (amount > originalAmount) {
        throw new Error("Transfer amount exceeds original posting amount");
      }

      // Get source ledger current balance
      const { data: sourceLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", sourceLedgerAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sourceCurrentBalance = sourceLastPosting?.running_balance || 0;

      // Get destination ledger current balance
      const { data: destLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", destinationLedgerAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const destCurrentBalance = destLastPosting?.running_balance || 0;

      const transferDescription = transferNote || `Transfer: ${sourcePosting.description}`;

      // 1. Create credit posting on source folio (reduces balance)
      const sourceNewBalance = sourceCurrentBalance - amount;
      const { error: sourceCreditError } = await supabase.from("folio_postings").insert({
        ledger_account_id: sourceLedgerAccountId,
        posting_type: "transfer_out",
        description: `TRANSFER OUT: ${transferDescription}`,
        amount: -amount,
        debit_amount: 0,
        credit_amount: amount,
        running_balance: sourceNewBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: sourcePosting.account_id,
        source_posting_id: sourcePostingId,
        transfer_note: transferNote,
      });

      if (sourceCreditError) throw sourceCreditError;

      // Update source ledger balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: sourceNewBalance })
        .eq("id", sourceLedgerAccountId);

      // 2. Create debit posting on destination folio (increases balance)
      const destNewBalance = destCurrentBalance + amount;
      const { data: newDestPosting, error: destDebitError } = await supabase.from("folio_postings").insert({
        ledger_account_id: destinationLedgerAccountId,
        posting_type: "transfer_in",
        description: `TRANSFER IN: ${transferDescription}`,
        amount: amount,
        debit_amount: amount,
        credit_amount: 0,
        running_balance: destNewBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: sourcePosting.account_id,
        source_posting_id: sourcePostingId,
        source_ledger_account_id: sourceLedgerAccountId,
        transfer_note: transferNote,
      }).select().single();

      if (destDebitError) throw destDebitError;

      // Update destination ledger balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: destNewBalance })
        .eq("id", destinationLedgerAccountId);

      // 3. Create ledger transactions for audit trail
      await supabase.from("ledger_transactions").insert([
        {
          ledger_account_id: sourceLedgerAccountId,
          transaction_type: "transfer",
          description: `Transfer out: ${transferDescription}`,
          debit_amount: 0,
          credit_amount: amount,
          posted_by_name: staffName,
          account_id: sourcePosting.account_id,
        },
        {
          ledger_account_id: destinationLedgerAccountId,
          transaction_type: "transfer",
          description: `Transfer in: ${transferDescription}`,
          debit_amount: amount,
          credit_amount: 0,
          posted_by_name: staffName,
          account_id: sourcePosting.account_id,
        },
      ]);

      toast.success("Charge transferred successfully");
      setIsTransferring(false);

      return { 
        success: true, 
        newPostingId: newDestPosting?.id 
      };
    } catch (err) {
      console.error("Error transferring posting:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to transfer charge";
      toast.error(errorMessage);
      setIsTransferring(false);
      return { success: false, error: errorMessage };
    }
  };

  const transferAmountBetweenFolios = async (params: {
    sourceLedgerAccountId: string;
    destinationLedgerAccountId: string;
    amount: number;
    description: string;
    auditDate: string;
  }): Promise<TransferResult> => {
    const { sourceLedgerAccountId, destinationLedgerAccountId, amount, description, auditDate } = params;

    if (sourceLedgerAccountId === destinationLedgerAccountId) {
      return { success: false, error: "Cannot transfer to the same folio" };
    }

    if (amount <= 0) {
      return { success: false, error: "Transfer amount must be positive" };
    }

    setIsTransferring(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Get current balances
      const { data: sourceLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", sourceLedgerAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: destLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", destinationLedgerAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sourceBalance = sourceLastPosting?.running_balance || 0;
      const destBalance = destLastPosting?.running_balance || 0;

      const sourceNewBalance = sourceBalance - amount;
      const destNewBalance = destBalance + amount;

      // Create transfer postings
      await supabase.from("folio_postings").insert({
        ledger_account_id: sourceLedgerAccountId,
        posting_type: "transfer_out",
        description: `TRANSFER OUT: ${description}`,
        amount: -amount,
        debit_amount: 0,
        credit_amount: amount,
        running_balance: sourceNewBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        source_ledger_account_id: destinationLedgerAccountId,
        transfer_note: description,
      });

      const { data: newPosting } = await supabase.from("folio_postings").insert({
        ledger_account_id: destinationLedgerAccountId,
        posting_type: "transfer_in",
        description: `TRANSFER IN: ${description}`,
        amount: amount,
        debit_amount: amount,
        credit_amount: 0,
        running_balance: destNewBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        source_ledger_account_id: sourceLedgerAccountId,
        transfer_note: description,
      }).select().single();

      // Update balances
      await Promise.all([
        supabase.from("ledger_accounts").update({ balance: sourceNewBalance }).eq("id", sourceLedgerAccountId),
        supabase.from("ledger_accounts").update({ balance: destNewBalance }).eq("id", destinationLedgerAccountId),
      ]);

      // Create ledger transactions
      await supabase.from("ledger_transactions").insert([
        {
          ledger_account_id: sourceLedgerAccountId,
          transaction_type: "transfer",
          description: `Transfer to another folio: ${description}`,
          debit_amount: 0,
          credit_amount: amount,
          posted_by_name: staffName,
        },
        {
          ledger_account_id: destinationLedgerAccountId,
          transaction_type: "transfer",
          description: `Transfer from another folio: ${description}`,
          debit_amount: amount,
          credit_amount: 0,
          posted_by_name: staffName,
        },
      ]);

      toast.success("Amount transferred successfully");
      setIsTransferring(false);
      return { success: true, newPostingId: newPosting?.id };
    } catch (err) {
      console.error("Error transferring amount:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to transfer amount";
      toast.error(errorMessage);
      setIsTransferring(false);
      return { success: false, error: errorMessage };
    }
  };

  return {
    transferPosting,
    transferAmountBetweenFolios,
    isTransferring,
  };
};
