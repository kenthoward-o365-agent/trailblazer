interface BrandInfo {
  name: string;
  tagline: string;
  shortName: string;
}

// Trailblazer is the only brand now.
export function useBrandName(): BrandInfo {
  return {
    name: "Trailblazer",
    tagline: "Campground Management",
    shortName: "Trailblazer",
  };
}

export default useBrandName;
