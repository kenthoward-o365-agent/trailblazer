-- Create RLS policies for campground-maps storage bucket

-- Allow authenticated users to upload map images
CREATE POLICY "Authenticated users can upload campground maps"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campground-maps');

-- Allow authenticated users to update map images
CREATE POLICY "Authenticated users can update campground maps"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'campground-maps');

-- Allow authenticated users to delete map images
CREATE POLICY "Authenticated users can delete campground maps"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'campground-maps');

-- Allow public read access to campground maps
CREATE POLICY "Public users can view campground maps"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campground-maps');