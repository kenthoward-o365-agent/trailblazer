import { DashboardLayout } from "@/components/DashboardLayout";
import { usePropertySettings } from "@/hooks/usePropertySettings";
import { PropertySelector } from "@/components/settings/PropertySelector";
import { PropertyContactCard } from "@/components/settings/PropertyContactCard";
import { PaymentGatewayCard } from "@/components/settings/PaymentGatewayCard";
import { SecuritySettingsCard } from "@/components/SecuritySettingsCard";
import { ApiKeysManagement } from "@/components/ApiKeysManagement";
import { IntegrationMappings } from "@/components/settings/IntegrationMappings";
import { GuestSharingSettings } from "@/components/GuestSharingSettings";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { downloadPosDocumentation } from "@/lib/posDocumentationPdf";
import { toast } from "sonner";

const PropertySettings = () => {
  const settings = usePropertySettings();

  if (settings.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading property settings...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Property Settings</h1>
            <p className="text-muted-foreground">
              Manage your property contact information
            </p>
          </div>
          {settings.selectedProperty && settings.canEditPaymentGateway && (
            <Button
              variant="secondary"
              onClick={() => {
                const success = downloadPosDocumentation(settings.selectedProperty?.name);
                if (!success) {
                  toast.error("Could not generate PDF. Please try again.");
                }
              }}
              className="gap-2 shrink-0"
            >
              <FileText className="h-4 w-4" />
              Download POS API Docs
            </Button>
          )}
        </div>

        <PropertySelector
          properties={settings.properties}
          selectedPropertyId={settings.selectedProperty?.id || null}
          onSelect={settings.handleSelectProperty}
        />

        {settings.selectedProperty && (
          <PropertyContactCard
            selectedProperty={settings.selectedProperty}
            propertiesCount={settings.properties.length}
            terminology={settings.terminology}
            phone1={settings.phone1}
            setPhone1={settings.setPhone1}
            phone2={settings.phone2}
            setPhone2={settings.setPhone2}
            email={settings.email}
            setEmail={settings.setEmail}
            website={settings.website}
            setWebsite={settings.setWebsite}
            requireRoomAtBooking={settings.requireRoomAtBooking}
            setRequireRoomAtBooking={settings.setRequireRoomAtBooking}
            saving={settings.saving}
            onSave={settings.handleSave}
          />
        )}

        {settings.canEditPaymentGateway && settings.selectedProperty && (
          <PaymentGatewayCard
            paymentGatewayMode={settings.paymentGatewayMode}
            setPaymentGatewayMode={settings.setPaymentGatewayMode}
            adyenClientKey={settings.adyenClientKey}
            setAdyenClientKey={settings.setAdyenClientKey}
            adyenMerchantAccount={settings.adyenMerchantAccount}
            setAdyenMerchantAccount={settings.setAdyenMerchantAccount}
            saving={settings.saving}
            onSave={settings.handleSave}
          />
        )}

        {settings.canEditPaymentGateway && settings.selectedProperty && (
          <SecuritySettingsCard
            settings={settings.securitySettings}
            onChange={settings.setSecuritySettings}
          />
        )}

        {settings.canEditPaymentGateway && settings.selectedProperty && (
          <ApiKeysManagement propertyId={settings.selectedProperty.id} />
        )}

        {settings.canEditPaymentGateway && settings.selectedProperty && (
          <IntegrationMappings propertyId={settings.selectedProperty.id} />
        )}

        {settings.isOrgAdmin && settings.properties.length > 1 && (
          <GuestSharingSettings />
        )}
      </div>
    </DashboardLayout>
  );
};

export default PropertySettings;
