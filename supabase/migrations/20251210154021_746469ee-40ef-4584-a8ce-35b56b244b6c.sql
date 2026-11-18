-- Create storage bucket for campaign images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload campaign images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-images' AND auth.role() = 'authenticated');

-- Allow public access to view campaign images
CREATE POLICY "Public can view campaign images"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete campaign images"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-images' AND auth.role() = 'authenticated');