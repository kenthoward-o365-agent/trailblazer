import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, Calendar, DollarSign, Printer, RotateCcw, MapPin, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import { toast } from "sonner";

interface ClosedFolio {
  id: string;
  balance: number;
  closed_at: string;
  reservations: {
    id: string;
    confirmation_number: string;
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    sites: {
      site_number: string;
      site_types: { name: string };
    } | null;
    guests: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
  };
}

interface FolioPosting {
  id: string;
  posting_date: string;
  posting_type: string;
  description: string;
  debit_amount: number | null;
  credit_amount: number | null;
  running_balance: number;
  posted_by_name: string | null;
  created_at: string;
  accounts: {
    code: string;
    name: string;
  } | null;
}

type ReceiptViewMode = "detail" | "summary";

const FolioReview = () => {
  const { folioId } = useParams<{ folioId: string }>();
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  
  const [folio, setFolio] = useState<ClosedFolio | null>(null);
  const [postings, setPostings] = useState<FolioPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [postingsLoading, setPostingsLoading] = useState(false);
  const [receiptViewMode, setReceiptViewMode] = useState<ReceiptViewMode>("detail");
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    if (folioId && selectedProperty?.id) {
      loadFolio();
    }
  }, [folioId, selectedProperty?.id]);

  useEffect(() => {
    if (folio) {
      loadFolioPostings();
    }
  }, [folio?.id]);

  const loadFolio = async () => {
    if (!folioId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ledger_accounts")
        .select(`
          id,
          balance,
          closed_at,
          reservations!ledger_accounts_reservation_id_fkey (
            id,
            confirmation_number,
            check_in_date,
            check_out_date,
            total_price,
            sites (
              site_number,
              site_types (name)
            ),
            guests (
              id,
              first_name,
              last_name,
              email,
              phone
            )
          )
        `)
        .eq("id", folioId)
        .single();

      if (error) throw error;
      setFolio(data as ClosedFolio);
    } catch (error) {
      console.error("Error loading folio:", error);
      toast.error("Failed to load folio");
      navigate("/guest-history");
    } finally {
      setLoading(false);
    }
  };

  const loadFolioPostings = async () => {
    if (!folio?.id) return;
    
    setPostingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("folio_postings")
        .select(`
          id,
          posting_date,
          posting_type,
          description,
          debit_amount,
          credit_amount,
          running_balance,
          posted_by_name,
          created_at,
          accounts (
            code,
            name
          )
        `)
        .eq("ledger_account_id", folio.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPostings((data as FolioPosting[]) || []);
    } catch (error) {
      console.error("Error loading folio postings:", error);
    } finally {
      setPostingsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Memoized summary data for both display and print
  const accountSummary = useMemo(() => {
    return postings.reduce((acc, posting) => {
      const key = posting.accounts?.code || 'OTHER';
      const name = posting.accounts?.name || (posting.posting_type === 'payment' ? 'Payments' : 'Other');
      if (!acc[key]) {
        acc[key] = { code: key, name, debits: 0, credits: 0, descriptions: [] as string[] };
      }
      acc[key].debits += posting.debit_amount || 0;
      acc[key].credits += posting.credit_amount || 0;
      if (posting.description?.trim()) {
        acc[key].descriptions.push(posting.description.trim());
      }
      return acc;
    }, {} as Record<string, { code: string; name: string; debits: number; credits: number; descriptions: string[] }>);
  }, [postings]);

  const summaryRows = useMemo(() => {
    return Object.values(accountSummary).sort((a, b) => a.code.localeCompare(b.code));
  }, [accountSummary]);

  const summaryTotals = useMemo(() => ({
    debits: summaryRows.reduce((sum, row) => sum + row.debits, 0),
    credits: summaryRows.reduce((sum, row) => sum + row.credits, 0),
  }), [summaryRows]);

  const handleReactivateFolio = async () => {
    if (!folio || !selectedProperty?.id) return;

    setReactivating(true);
    try {
      const { data: outSite, error: siteError } = await supabase
        .from("sites")
        .select("id")
        .eq("property_id", selectedProperty.id)
        .eq("site_number", "*Out")
        .maybeSingle();

      if (siteError || !outSite) {
        toast.error("System room *Out not found. Please contact support.");
        setReactivating(false);
        return;
      }

      const reservationId = folio.reservations?.id;
      if (!reservationId) {
        toast.error("Reservation not found");
        setReactivating(false);
        return;
      }

      const { error: resError } = await supabase
        .from("reservations")
        .update({
          status: "CHECKED_IN",
          site_id: outSite.id,
        })
        .eq("id", reservationId);

      if (resError) throw resError;

      const { error: ledgerError } = await supabase
        .from("ledger_accounts")
        .update({
          is_active: true,
          closed_at: null,
        })
        .eq("id", folio.id);

      if (ledgerError) throw ledgerError;

      toast.success("Folio reactivated - Guest is now in room *Out for adjustments");
      navigate("/guest-history");
    } catch (error) {
      console.error("Error reactivating folio:", error);
      toast.error("Failed to reactivate folio");
    } finally {
      setReactivating(false);
    }
  };

  const handlePrintFolio = () => {
    if (!folio) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const guest = folio.reservations?.guests;
    const reservation = folio.reservations;
    
    // Use pre-calculated summary data from useMemo hooks

    const fmtCurrency = (amount: number) => `$${Math.abs(amount).toFixed(2)}${amount < 0 ? ' CR' : ''}`;

    const detailRows = postings.map(p => `
      <tr>
        <td>${format(parseLocalDate(p.posting_date), "MM/dd")}</td>
        <td>${p.accounts?.name || '-'}</td>
        <td>${p.description || ''}</td>
        <td class="text-right">${p.debit_amount ? fmtCurrency(p.debit_amount) : ''}</td>
        <td class="text-right credit">${p.credit_amount ? fmtCurrency(p.credit_amount) : ''}</td>
        <td class="text-right">${fmtCurrency(p.running_balance)}</td>
      </tr>
    `).join('');

    const summaryRowsHtml = summaryRows.map(row => {
      const uniqueDescs = [...new Set(row.descriptions)].slice(0, 3).join(', ');
      const truncatedDescs = uniqueDescs.length > 40 ? uniqueDescs.substring(0, 37) + '...' : uniqueDescs;
      return `
        <tr>
          <td class="mono">${row.code}</td>
          <td>${row.name}</td>
          <td>${truncatedDescs}</td>
          <td class="text-right">${row.debits > 0 ? fmtCurrency(row.debits) : ''}</td>
          <td class="text-right credit">${row.credits > 0 ? fmtCurrency(row.credits) : ''}</td>
        </tr>
      `;
    }).join('');

    const tableContent = receiptViewMode === "detail" ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Account Name</th>
            <th>Post Charge Description</th>
            <th class="text-right">Debit</th>
            <th class="text-right">Credit</th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5"><strong>Balance Due</strong></td>
            <td class="text-right"><strong>${fmtCurrency(folio.balance)}</strong></td>
          </tr>
        </tfoot>
      </table>
    ` : `
      <table>
        <thead>
          <tr>
            <th>Account Code</th>
            <th>Account</th>
            <th>Details</th>
            <th class="text-right">Total Debits</th>
            <th class="text-right">Total Credits</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
        </tbody>
        <tfoot>
          <tr class="subtotal-row">
            <td colspan="3"><strong>Totals</strong></td>
            <td class="text-right"><strong>${fmtCurrency(summaryTotals.debits)}</strong></td>
            <td class="text-right credit"><strong>${fmtCurrency(summaryTotals.credits)}</strong></td>
          </tr>
          <tr class="total-row">
            <td colspan="4"><strong>Balance Due</strong></td>
            <td class="text-right"><strong>${fmtCurrency(folio.balance)}</strong></td>
          </tr>
        </tfoot>
      </table>
    `;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Folio - ${guest?.first_name} ${guest?.last_name}</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 10px;
            padding: 10px 15px; 
            max-width: 800px; 
            margin: 0 auto; 
            line-height: 1.3;
          }
          .header { 
            text-align: center;
            border-bottom: 1px solid #333; 
            padding-bottom: 8px; 
            margin-bottom: 8px; 
          }
          .header h2 { 
            font-size: 14px; 
            margin: 0 0 3px 0; 
          }
          .header p { 
            margin: 0; 
            color: #666; 
            font-size: 9px;
          }
          .guest-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px;
            font-size: 10px;
          }
          .guest-info .left p, .guest-info .right p { margin: 0; }
          .guest-info .right { text-align: right; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9px;
            margin-bottom: 8px;
          }
          th, td { 
            border: 1px solid #ccc; 
            padding: 2px 4px; 
            text-align: left; 
          }
          th { 
            background-color: #f0f0f0; 
            font-size: 8px;
            font-weight: bold;
          }
          .text-right { text-align: right; }
          .credit { color: #059669; }
          .mono { font-family: monospace; font-size: 8px; }
          .subtotal-row td { border-top: 1px solid #666; }
          .total-row td { border-top: 2px solid #333; background: #f9f9f9; }
          .footer { 
            text-align: center; 
            font-size: 8px; 
            color: #666; 
            border-top: 1px solid #ccc; 
            padding-top: 6px;
            margin-top: 8px;
          }
          @media print {
            @page { margin: 0.4cm; size: auto; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${selectedProperty?.name || 'Property'}</h2>
          <p>Guest Folio - ${receiptViewMode === "detail" ? "Detail" : "Summary"}</p>
        </div>
        <div class="guest-info">
          <div class="left">
            <p><strong>${guest?.first_name} ${guest?.last_name}</strong></p>
            <p>${guest?.email || ''}</p>
          </div>
          <div class="right">
            <p>${terminology.site} ${reservation?.sites?.site_number || 'N/A'}</p>
            <p>${reservation?.check_in_date ? format(parseLocalDate(reservation.check_in_date), "MM/dd/yyyy") : ''} - ${reservation?.check_out_date ? format(parseLocalDate(reservation.check_out_date), "MM/dd/yyyy") : ''}</p>
            <p>Conf# ${reservation?.confirmation_number || 'N/A'}</p>
          </div>
        </div>
        ${tableContent}
        <div class="footer">Thank you for staying with us!</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading folio...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!folio) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-muted-foreground">Folio not found</p>
          <Button variant="outline" onClick={() => navigate("/guest-history")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Guest History
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const guest = folio.reservations?.guests;
  const reservation = folio.reservations;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3 md:gap-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/guest-history")} className="shrink-0">
              <ArrowLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">
                {guest?.first_name} {guest?.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Badge variant="secondary">#{reservation?.confirmation_number}</Badge>
                <span className="hidden sm:inline">•</span>
                <span>Closed {folio.closed_at && format(new Date(folio.closed_at), "MMM dd, yyyy")}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={receiptViewMode === "detail" ? "default" : "ghost"}
                size="sm"
                onClick={() => setReceiptViewMode("detail")}
                className="rounded-r-none"
              >
                Detail
              </Button>
              <Button
                variant={receiptViewMode === "summary" ? "default" : "ghost"}
                size="sm"
                onClick={() => setReceiptViewMode("summary")}
                className="rounded-l-none"
              >
                Summary
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrintFolio}>
              <Printer className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Print</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setReactivateDialogOpen(true)}
            >
              <RotateCcw className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Reactivate</span>
            </Button>
          </div>
        </div>


        {/* Guest & Stay Info */}
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Guest</div>
                <div className="text-sm font-medium">{guest?.first_name} {guest?.last_name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm font-medium">{guest?.email || '-'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">{terminology.site}</div>
                <div className="text-sm font-medium">{reservation?.sites?.site_number || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Stay Dates</div>
                <div className="text-sm font-medium">
                  {reservation?.check_in_date && format(parseLocalDate(reservation.check_in_date), "MMM dd")} -{" "}
                  {reservation?.check_out_date && format(parseLocalDate(reservation.check_out_date), "MMM dd, yyyy")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Final Balance</div>
                <div className={`text-sm font-medium ${folio.balance !== 0 ? "text-destructive" : "text-green-600"}`}>
                  {formatCurrency(folio.balance)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Posting History */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Posting History</h3>
          {postingsLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading postings...</div>
          ) : postings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No postings found</div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              {receiptViewMode === "detail" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postings.map((posting) => (
                      <TableRow key={posting.id}>
                        <TableCell className="text-sm">
                          {format(parseLocalDate(posting.posting_date), "MMM dd")}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{posting.description}</div>
                          {posting.posted_by_name && (
                            <div className="text-xs text-muted-foreground">
                              by {posting.posted_by_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {posting.accounts?.code || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {posting.debit_amount ? formatCurrency(posting.debit_amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {posting.credit_amount ? formatCurrency(posting.credit_amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(posting.running_balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Total Debits</TableHead>
                      <TableHead className="text-right">Total Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.code}>
                        <TableCell className="font-mono text-sm">{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {[...new Set(row.descriptions)].slice(0, 3).join(', ')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.debits > 0 ? formatCurrency(row.debits) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-green-600">
                          {row.credits > 0 ? formatCurrency(row.credits) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-semibold bg-muted/30">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className="text-right">{formatCurrency(summaryTotals.debits)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(summaryTotals.credits)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={4}>Balance Due</TableCell>
                      <TableCell className={`text-right ${folio.balance !== 0 ? "text-destructive" : "text-green-600"}`}>
                        {formatCurrency(folio.balance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Reactivate Folio Confirmation Dialog */}
      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Folio for Adjustments?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will reopen the folio for posting adjustments (refunds, corrections, etc.).
              </p>
              <p>
                The guest will be checked into the system {terminology.site.toLowerCase()} <strong>*Out</strong> until the balance is resolved.
              </p>
              <p>
                When the balance reaches zero and the next day-end close runs, the folio will automatically return to Guest History.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReactivateFolio}
              disabled={reactivating}
            >
              {reactivating ? "Reactivating..." : "Reactivate Folio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default FolioReview;
