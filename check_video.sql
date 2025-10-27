SELECT 
  id,
  title,
  is_chunked,
  chunk_count,
  array_length(chunk_paths, 1) as actual_chunk_paths_count,
  file_size,
  created_at,
  chunk_paths
FROM videos 
WHERE id = '4bd4c226-a92a-410e-83b9-77919088f4d6';
