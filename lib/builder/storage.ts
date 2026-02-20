// Storage access strategy: buckets are expected to be public-read for published assets and uploads.
// If you need private buckets, switch published routes to use a service-role client and signed URLs.
export const BUILDER_SITES_BUCKET = "builder-sites";
export const BUILDER_ASSETS_BUCKET = "builder-assets";
