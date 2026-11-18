import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Property {
  id: string;
  name: string;
  address: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  website: string | null;
  customer_id: number | null;
  max_sites: number | null;
  organization_id: string | null;
  // Legacy fields retained for downstream consumers — always campground / unit_required now.
  property_type: 'campground';
  inventory_mode: 'unit_required';
  country: string | null;
  timezone: string | null;
  payment_gateway_mode: string | null;
  adyen_client_key: string | null;
  adyen_merchant_account: string | null;
}

interface OrganizationInfo {
  id: string;
  name: string;
  payment_status: string;
  billing_email: string | null;
}

interface PropertyContextType {
  properties: Property[];
  selectedProperty: Property | null;
  setSelectedPropertyId: (id: string) => void;
  refreshProperties: () => Promise<void>;
  loading: boolean;
  organization: OrganizationInfo | null;
  isSuspended: boolean;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const SELECTED_PROPERTY_KEY = "roommaster_selected_property";

const PROPERTY_SELECT =
  "id, name, address, phone1, phone2, email, website, customer_id, max_sites, organization_id, country, timezone, payment_gateway_mode, adyen_client_key, adyen_merchant_account";

const withDefaults = (rows: any[] | null): Property[] =>
  (rows || []).map((r) => ({
    ...r,
    property_type: 'campground' as const,
    inventory_mode: 'unit_required' as const,
  }));

export const PropertyProvider = ({ children }: { children: ReactNode }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);

  const fetchIdRef = useRef(0);

  const fetchProperties = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (currentFetchId === fetchIdRef.current) {
          setProperties([]);
          setOrganization(null);
          setLoading(false);
        }
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (currentFetchId !== fetchIdRef.current) return;

      const isSuperAdmin = !!roleData;

      let data: Property[] = [];
      let orgData: OrganizationInfo | null = null;

      if (isSuperAdmin) {
        const { data: allProps, error } = await supabase
          .from("properties")
          .select(PROPERTY_SELECT)
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        data = withDefaults(allProps);
      } else {
        const { data: accessData, error: accessError } = await supabase
          .from("user_property_access")
          .select(`property_id, is_org_admin, organization_id`)
          .eq("user_id", user.id);

        if (accessError) throw accessError;

        if (currentFetchId !== fetchIdRef.current) return;

        if (accessData && accessData.length > 0) {
          const isOrgAdmin = accessData.some((a) => a.is_org_admin);
          const orgId = accessData[0]?.organization_id;

          if (isOrgAdmin && orgId) {
            const { data: orgProps, error } = await supabase
              .from("properties")
              .select(PROPERTY_SELECT)
              .eq("organization_id", orgId)
              .eq("is_active", true)
              .order("name");

            if (error) throw error;
            data = withDefaults(orgProps);

            const { data: fetchedOrgData } = await supabase
              .from("organizations")
              .select("id, name, payment_status, billing_email")
              .eq("id", orgId)
              .single();

            orgData = fetchedOrgData;
          } else {
            const propertyIds = accessData
              .map((a) => a.property_id)
              .filter((id): id is string => id !== null);

            if (propertyIds.length > 0) {
              const { data: userProps, error } = await supabase
                .from("properties")
                .select(PROPERTY_SELECT)
                .in("id", propertyIds)
                .eq("is_active", true)
                .order("name");

              if (error) throw error;
              data = withDefaults(userProps);
            }

            if (orgId) {
              const { data: fetchedOrgData } = await supabase
                .from("organizations")
                .select("id, name, payment_status, billing_email")
                .eq("id", orgId)
                .single();

              orgData = fetchedOrgData;
            }
          }
        } else {
          const { data: fallbackProps, error } = await supabase
            .from("properties")
            .select(PROPERTY_SELECT)
            .eq("is_active", true)
            .order("name");

          if (error) throw error;
          data = withDefaults(fallbackProps);
        }
      }

      if (currentFetchId !== fetchIdRef.current) return;

      setProperties(data);
      setOrganization(orgData);

      if (data.length > 0) {
        const savedPropertyId = localStorage.getItem(SELECTED_PROPERTY_KEY);
        const savedExists = savedPropertyId && data.some((p) => p.id === savedPropertyId);

        if (savedExists) {
          setSelectedPropertyIdState(savedPropertyId);
        } else {
          setSelectedPropertyIdState(data[0].id);
          localStorage.setItem(SELECTED_PROPERTY_KEY, data[0].id);
        }
      } else {
        setSelectedPropertyIdState(null);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSelectedPropertyIdState(null);
        localStorage.removeItem(SELECTED_PROPERTY_KEY);
        setLoading(true);
        fetchProperties();
      } else if (event === 'SIGNED_OUT') {
        fetchIdRef.current++;
        setProperties([]);
        setSelectedPropertyIdState(null);
        setOrganization(null);
        localStorage.removeItem(SELECTED_PROPERTY_KEY);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProperties();
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProperties]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) || null;

  useEffect(() => {
    const loadOrganization = async () => {
      if (selectedProperty?.organization_id && !organization) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, payment_status, billing_email")
          .eq("id", selectedProperty.organization_id)
          .single();

        if (orgData) {
          setOrganization(orgData);
        }
      } else if (!selectedProperty?.organization_id) {
        setOrganization(null);
      }
    };

    loadOrganization();
  }, [selectedProperty?.organization_id, organization]);

  const setSelectedPropertyId = (id: string) => {
    setSelectedPropertyIdState(id);
    localStorage.setItem(SELECTED_PROPERTY_KEY, id);
  };

  const isSuspended = organization?.payment_status === "suspended";

  return (
    <PropertyContext.Provider
      value={{
        properties,
        selectedProperty,
        setSelectedPropertyId,
        refreshProperties: fetchProperties,
        loading,
        organization,
        isSuspended,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return context;
};
