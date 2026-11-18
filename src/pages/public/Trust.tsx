import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Globe, FileText, Server, Key } from "lucide-react";
import { Link } from "react-router-dom";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Trust & Security</h1>
          <p className="text-muted-foreground">
            This page is maintained by Trailblazer to answer common security and privacy
            questions about the platform. It describes enabled controls today; it is not an
            independent certification.
          </p>
          <div className="flex gap-2 pt-2">
            <Link to="/status"><Badge variant="outline">Service Status →</Badge></Link>
          </div>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Shield className="h-5 w-5" /><CardTitle>Access & Authentication</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Email + password with password history and lockout controls.</p>
              <p>Mandatory TOTP MFA for sensitive financial data and exports.</p>
              <p>SAML 2.0 SSO available for enterprise identity providers.</p>
              <p>Role-based access scoped to Organization, Brand, Region, or Property.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Lock className="h-5 w-5" /><CardTitle>Payment Data (PCI)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>SAQ A scope — card capture outsourced to Adyen Drop-in.</p>
              <p>No raw PAN or CVV is stored, logged, or transmitted by the app.</p>
              <p>Automated retention sweeps remove aged authorizations and card metadata.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Globe className="h-5 w-5" /><CardTitle>Data Residency</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Data can be provisioned in the US, Canada, or EU region per organization.</p>
              <p>Regional selection is captured at contract time and enforced in provisioning.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Key className="h-5 w-5" /><CardTitle>Customer-Managed Keys</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Optional BYOK for encrypted exports using a customer-supplied KMS key.</p>
              <p>Key reference is stored per organization; raw key material stays with the customer.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Server className="h-5 w-5" /><CardTitle>Operations & Reliability</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Public status page with active-incident feed.</p>
              <p>Nightly portfolio metric rollups keep enterprise reporting stable at 400+ parks.</p>
              <p>Per-organization API and booking-engine quotas protect shared capacity.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText className="h-5 w-5" /><CardTitle>Legal & Compliance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>DPA and subprocessor list available on request per organization.</p>
              <p>SOC 2 Type II readiness in progress. Contact your account team for the latest report.</p>
              <p>Security contact and incident-response details are surfaced per customer.</p>
            </CardContent>
          </Card>
        </section>

        <section className="text-sm text-muted-foreground border-t pt-4">
          <p>
            This page describes controls the platform exposes today. It is not a certification and does not
            constitute a legal warranty. For contractual commitments, refer to your master services agreement
            and data processing addendum.
          </p>
        </section>
      </div>
    </div>
  );
}
