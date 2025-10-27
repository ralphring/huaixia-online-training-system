import React, { useState, useRef } from 'react'
import { Upload, Loader, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface UploadZoneProps {
  onUploadComplete: () => void
}

interface UploadProgress {
  percent: number
  uploadedBytes: number
  totalBytes: number
  speed: number // bytes per second
  remainingTime: number // seconds
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    percent: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0
  })
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [downloadable, setDownloadable] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const uploadStartTimeRef = useRef<number>(0)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleUpload(files[0])
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}秒`
    if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
    return `${Math.round(seconds / 3600)}小时`
  }

  async function handleUpload(file: File) {
    if (!user) return

    setUploading(true)
    setStatus('uploading')
    setUploadProgress({
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      speed: 0,
      remainingTime: 0
    })
    uploadStartTimeRef.current = Date.now()

    try {
      // Generate safe ASCII-only filename
      const fileExt = file.name.substring(file.name.lastIndexOf('.'))
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const safeFileName = `${timestamp}-${randomStr}${fileExt}`
      
      // Preserve original filename in title (with Chinese characters)
      const originalTitle = file.name.replace(/\.[^/.]+$/, '')

      const fileSizeMB = file.size / (1024 * 1024)
      
      // For large files (>40MB), use chunked upload without merging
      if (fileSizeMB > 40) {
        setMessage(`文件较大 (${formatBytes(file.size)})，正在使用分块上传...`)
        await uploadLargeFileChunked(file, safeFileName, originalTitle)
      } else {
        setMessage('正在上传...')
        await uploadSmallFile(file, safeFileName, originalTitle)
      }

      setStatus('success')
      setMessage('视频上传成功')
      setTimeout(() => {
        setStatus('idle')
        setUploadProgress({
          percent: 0,
          uploadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          remainingTime: 0
        })
        onUploadComplete()
      }, 2000)
    } catch (error: any) {
      console.error('Upload failed:', error)
      setStatus('error')
      
      // Provide specific error messages
      let errorMsg = '上传失败'
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMsg = '网络连接失败，请检查网络后重试'
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        errorMsg = '上传权限不足，请重新登录'
      } else if (error.message) {
        errorMsg = `上传失败: ${error.message}`
      }
      
      setMessage(errorMsg)
      setTimeout(() => {
        setStatus('idle')
        setUploadProgress({
          percent: 0,
          uploadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          remainingTime: 0
        })
      }, 5000)
    } finally {
      setUploading(false)
    }
  }

  async function uploadSmallFile(file: File, safeFileName: string, originalTitle: string) {
    console.log(`Uploading small file: ${file.name}, size: ${formatBytes(file.size)}`)
    
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(safeFileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'video/mp4'
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`上传失败: ${uploadError.message}`)
    }

    setUploadProgress({
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      speed: file.size / ((Date.now() - uploadStartTimeRef.current) / 1000),
      remainingTime: 0
    })

    // Save to database (not chunked)
    const { error: dbError } = await supabase
      .from('videos')
      .insert({
        title: originalTitle,
        file_path: safeFileName,
        user_id: user!.id,
        is_enabled: true,
        is_chunked: false,
        file_size: file.size,
        downloadable
      })

    if (dbError) {
      console.error('Database error:', dbError)
      await supabase.storage.from('videos').remove([safeFileName])
      throw new Error(`保存视频信息失败: ${dbError.message}`)
    }
  }

  async function uploadLargeFileChunked(file: File, baseFileName: string, originalTitle: string) {
    const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const mimeType = file.type || 'video/mp4'
    const chunkPaths: string[] = []
    
    console.log(`Starting chunked upload: ${totalChunks} chunks, ${formatBytes(file.size)} total`)
    
    const startTime = Date.now()
    let uploadedBytes = 0

    // Upload each chunk
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunkBlob = file.slice(start, end)
      
      const chunkFileName = `${baseFileName}.part${chunkIndex}`
      const chunkFile = new File([chunkBlob], chunkFileName, { type: mimeType })
      
      console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks}`)
      
      const { error: chunkError } = await supabase.storage
        .from('videos')
        .upload(chunkFileName, chunkFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType
        })

      if (chunkError) {
        // Cleanup uploaded chunks on error
        if (chunkPaths.length > 0) {
          await supabase.storage.from('videos').remove(chunkPaths)
        }
        throw new Error(`上传失败 (块 ${chunkIndex + 1}/${totalChunks}): ${chunkError.message}`)
      }
      
      chunkPaths.push(chunkFileName)
      uploadedBytes += chunkBlob.size
      
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const speed = uploadedBytes / elapsedSeconds
      const remainingBytes = file.size - uploadedBytes
      const remainingTime = remainingBytes / speed
      
      setUploadProgress({
        percent: Math.round((uploadedBytes / file.size) * 100),
        uploadedBytes,
        totalBytes: file.size,
        speed,
        remainingTime
      })
      
      console.log(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} (${formatBytes(uploadedBytes)}/${formatBytes(file.size)})`)
    }

    console.log('All chunks uploaded, saving to database...')
    
    // Save to database with chunk info (NO merging)
    const { error: dbError } = await supabase
      .from('videos')
      .insert({
        title: originalTitle,
        file_path: baseFileName, // Base filename for reference
        user_id: user!.id,
        is_enabled: true,
        is_chunked: true,
        chunk_count: totalChunks,
        chunk_paths: chunkPaths,
        file_size: file.size,
        downloadable
      })

    if (dbError) {
      console.error('Database error:', dbError)
      // Cleanup all uploaded chunks
      await supabase.storage.from('videos').remove(chunkPaths)
      throw new Error(`保存视频信息失败: ${dbError.message}`)
    }
    
    setUploadProgress({
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      speed: file.size / ((Date.now() - startTime) / 1000),
      remainingTime: 0
    })
  }



  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative min-h-60 rounded-xl border-2 border-dashed transition-all duration-250 ${
        isDragging
          ? 'bg-primary-50 border-primary-500'
          : 'bg-neutral-50 border-neutral-200'
      }`}
    >
      <div className="py-16 px-8 text-center">
        <div className="flex justify-center mb-4">
          {status === 'idle' && (
            <Upload
              className={`w-12 h-12 ${
                isDragging ? 'text-primary-500' : 'text-neutral-400'
              }`}
            />
          )}
          {status === 'uploading' && (
            <Loader className="w-12 h-12 text-primary-500 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-12 h-12 text-success-500" />
          )}
          {status === 'error' && (
            <XCircle className="w-12 h-12 text-error-500" />
          )}
        </div>

        <p className="text-lg font-medium text-neutral-900 mb-2">
          {status === 'uploading'
            ? '正在上传...'
            : status === 'success'
            ? '上传成功'
            : status === 'error'
            ? '上传失败'
            : '拖拽视频文件到此处'}
        </p>
        <p className="text-sm text-neutral-400 mb-6">
          {message || '或点击选择文件，支持MP4/MOV/AVI/WEBM格式'}
        </p>

        {status === 'uploading' && (
          <div className="max-w-md mx-auto mb-6">
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-neutral-700 font-medium">{uploadProgress.percent}%</p>
              <p className="text-xs text-neutral-500">
                {formatBytes(uploadProgress.uploadedBytes)} / {formatBytes(uploadProgress.totalBytes)}
              </p>
              {uploadProgress.speed > 0 && (
                <>
                  <p className="text-xs text-neutral-500">
                    速度: {formatBytes(uploadProgress.speed)}/s
                  </p>
                  <p className="text-xs text-neutral-500">
                    剩余时间: {formatTime(uploadProgress.remainingTime)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {status === 'idle' && (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <input
                type="checkbox"
                id="downloadable"
                checked={downloadable}
                onChange={(e) => setDownloadable(e.target.checked)}
                className="w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="downloadable" className="text-sm text-neutral-700 cursor-pointer">
                允许用户下载此视频
              </label>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-12 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-700 active:scale-98 transition-all duration-200 disabled:opacity-50"
            >
              选择文件
            </button>
          </>
        )}
      </div>
    </div>
  )
}
