import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { useOrgAdmin } from "@/hooks/useOrgAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { toast } from "sonner";

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requireMfa: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordRotationDays: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export const usePropertySettings = () => {
  const { properties, selectedProperty, setSelectedPropertyId, refreshProperties, loading } = useProperty();
  const { isOrgAdmin, loading: orgAdminLoading } = useOrgAdmin();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const terminology = usePropertyTerminology();
  const [saving, setSaving] = useState(false);

  // Admin / permission state
  const [isPropertyAdmin, setIsPropertyAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  // Form state for editable fields only
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [requireRoomAtBooking, setRequireRoomAtBooking] = useState(true);

  // Payment gateway state
  const [paymentGatewayMode, setPaymentGatewayMode] = useState<"mock" | "test" | "live">("mock");
  const [adyenClientKey, setAdyenClientKey] = useState("");
  const [adyenMerchantAccount, setAdyenMerchantAccount] = useState("");

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    sessionTimeoutMinutes: 15,
    requireMfa: false,
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: true,
    passwordRotationDays: 90,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 30,
  });

  const canEditPaymentGateway = isOrgAdmin || isSuperAdmin || isPropertyAdmin;
  const isLoading = loading || orgAdminLoading || superAdminLoading || adminLoading;

  // Update admin state based on user_roles (property-level admin)
  useEffect(() => {
    const checkPropertyAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsPropertyAdmin(false);
          setAdminLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error checking property admin status:", error);
        }

        setIsPropertyAdmin(!!data);
      } catch (err) {
        console.error("Error checking property admin status:", err);
        setIsPropertyAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    };

    checkPropertyAdmin();
  }, []);

  // Update form when selected property changes
  useEffect(() => {
    if (selectedProperty) {
      setPhone1(selectedProperty.phone1 || "");
      setPhone2(selectedProperty.phone2 || "");
      setEmail(selectedProperty.email || "");
      setWebsite(selectedProperty.website || "");
      // Campground PMS: always require site at booking.
      setRequireRoomAtBooking(true);
      // Payment gateway settings
      setPaymentGatewayMode((selectedProperty.payment_gateway_mode as "mock" | "test" | "live") || "mock");
      setAdyenClientKey(selectedProperty.adyen_client_key || "");
      setAdyenMerchantAccount(selectedProperty.adyen_merchant_account || "");
      // Security settings
      setSecuritySettings({
        sessionTimeoutMinutes: (selectedProperty as any).session_timeout_minutes || 15,
        requireMfa: (selectedProperty as any).require_mfa || false,
        passwordMinLength: (selectedProperty as any).password_min_length || 12,
        passwordRequireUppercase: (selectedProperty as any).password_require_uppercase ?? true,
        passwordRequireNumber: (selectedProperty as any).password_require_number ?? true,
        passwordRequireSpecial: (selectedProperty as any).password_require_special ?? true,
        passwordRotationDays: (selectedProperty as any).password_rotation_days || 90,
        maxFailedLoginAttempts: (selectedProperty as any).max_failed_login_attempts || 5,
        lockoutDurationMinutes: (selectedProperty as any).lockout_duration_minutes || 30,
      });
    }
  }, [selectedProperty]);

  const handleSave = async () => {
    if (!selectedProperty) return;

    setSaving(true);
    try {
      const updateData: any = {
        phone1: phone1.trim() || null,
        phone2: phone2.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
      };

      // Only update inventory_mode for hotels
      if (terminology.isHotel) {
        updateData.inventory_mode = requireRoomAtBooking ? 'unit_required' : 'type_floating';
      }

      // Include payment gateway settings if user has permission
      if (canEditPaymentGateway) {
        updateData.payment_gateway_mode = paymentGatewayMode;
        if (paymentGatewayMode === 'test' || paymentGatewayMode === 'live') {
          updateData.adyen_client_key = adyenClientKey.trim() || null;
          updateData.adyen_merchant_account = adyenMerchantAccount.trim() || null;
        }
        // Include security settings
        updateData.session_timeout_minutes = securitySettings.sessionTimeoutMinutes;
        updateData.require_mfa = securitySettings.requireMfa;
        updateData.password_min_length = securitySettings.passwordMinLength;
        updateData.password_require_uppercase = securitySettings.passwordRequireUppercase;
        updateData.password_require_number = securitySettings.passwordRequireNumber;
        updateData.password_require_special = securitySettings.passwordRequireSpecial;
        updateData.password_rotation_days = securitySettings.passwordRotationDays;
        updateData.max_failed_login_attempts = securitySettings.maxFailedLoginAttempts;
        updateData.lockout_duration_minutes = securitySettings.lockoutDurationMinutes;
      }

      const { error } = await supabase
        .from("properties")
        .update(updateData)
        .eq("id", selectedProperty.id);

      if (error) throw error;

      toast.success("Property settings saved successfully");
      await refreshProperties();
    } catch (error: any) {
      console.error("Error saving property:", error);
      toast.error(error.message || "Failed to save property settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
  };

  return {
    // Property data
    properties,
    selectedProperty,
    terminology,
    isLoading,
    saving,
    
    // Permissions
    isOrgAdmin,
    canEditPaymentGateway,
    
    // Contact info
    phone1,
    setPhone1,
    phone2,
    setPhone2,
    email,
    setEmail,
    website,
    setWebsite,
    
    // Booking settings
    requireRoomAtBooking,
    setRequireRoomAtBooking,
    
    // Payment gateway
    paymentGatewayMode,
    setPaymentGatewayMode,
    adyenClientKey,
    setAdyenClientKey,
    adyenMerchantAccount,
    setAdyenMerchantAccount,
    
    // Security
    securitySettings,
    setSecuritySettings,
    
    // Actions
    handleSave,
    handleSelectProperty,
  };
};
