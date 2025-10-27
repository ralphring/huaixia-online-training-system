import { supabase } from './src/lib/supabase'

async function checkVideo() {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, is_chunked, chunk_count, chunk_paths, file_size')
    .eq('id', '4bd4c226-a92a-410e-83b9-77919088f4d6')
    .single()
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Video info:')
  console.log('  Title:', data.title)
  console.log('  Is chunked:', data.is_chunked)
  console.log('  Chunk count:', data.chunk_count)
  console.log('  Actual chunk_paths length:', data.chunk_paths?.length || 0)
  console.log('  File size:', data.file_size)
  console.log('\nChunk paths:')
  data.chunk_paths?.forEach((path, i) => {
    console.log(`  ${i + 1}. ${path}`)
  })
  
  // Check if all chunks exist in storage
  console.log('\nChecking chunk existence in storage...')
  let foundCount = 0
  let missingCount = 0
  
  for (let i = 0; i < (data.chunk_paths?.length || 0); i++) {
    const path = data.chunk_paths[i]
    const { data: fileData, error: fileError } = await supabase.storage
      .from('videos')
      .list('', { search: path.split('/').pop() })
    
    if (fileError || !fileData || fileData.length === 0) {
      console.log(`  ❌ Chunk ${i + 1} MISSING: ${path}`)
      missingCount++
    } else {
      foundCount++
    }
  }
  
  console.log(`\nSummary: ${foundCount} found, ${missingCount} missing`)
}

checkVideo().catch(console.error)
