import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, Video } from '@/lib/supabase'
import { Loader, Lock, Download, AlertCircle } from 'lucide-react'

export function WatchPageFixed() {
  const { videoId } = useParams<{ videoId: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [chunkInfo, setChunkInfo] = useState<{ current: number; total: number } | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    loadVideo()
  }, [videoId])

  async function loadVideo() {
    if (!videoId) {
      setError('缺少视频ID参数')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      console.log('正在加载视频ID:', videoId)
      
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .maybeSingle()

      if (error) {
        console.error('数据库查询错误:', error)
        throw error
      }
      
      if (!data) {
        console.error('视频不存在，ID:', videoId)
        setError('视频不存在或已被删除')
        setLoading(false)
        return
      }

      console.log('视频数据加载成功:', data.title)
      setVideo(data)

      // 检查视频是否启用
      if (!data.is_enabled) {
        setError('该视频已停止分享')
        setLoading(false)
        return
      }

      // 如果不需要密码，直接加载视频
      setLoading(false)
      if (!data.access_password) {
        await loadVideoUrl(data.file_path, data.is_chunked, data.chunk_paths)
        setAuthenticated(true)
      }
      
    } catch (error: any) {
      console.error('加载视频失败:', error)
      setError(error.message || '加载失败')
      setLoading(false)
    }
  }

  // 优化的视频加载函数，包含重试机制
  async function loadVideoUrl(filePath: string, isChunked?: boolean, chunkPaths?: string[]) {
    console.log('开始加载视频:', { filePath, isChunked, chunkCount: chunkPaths?.length })
    
    setLoadingVideo(true)
    setLoadingProgress(0)
    setError('')
    setRetryCount(0)
    
    try {
      if (isChunked && chunkPaths && chunkPaths.length > 0) {
        await loadChunkedVideoWithRetry(chunkPaths)
      } else {
        await loadNormalVideoWithRetry(filePath)
      }
    } catch (error: any) {
      console.error('视频加载最终失败:', error)
      setError(`视频加载失败: ${error.message}`)
      setLoadingVideo(false)
    }
  }

  // 正常视频加载，带重试机制
  async function loadNormalVideoWithRetry(filePath: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setRetryCount(attempt - 1)
      console.log(`尝试加载视频 ${attempt}/${maxRetries}: ${filePath}`)
      
      try {
        setLoadingProgress(20 + (attempt - 1) * 20) // 20%, 40%, 60%
        
        const { data: videoData, error: downloadError } = await supabase.storage
          .from('videos')
          .download(filePath)
        
        if (downloadError) {
          console.error(`下载错误 (尝试 ${attempt}):`, downloadError)
          throw new Error(`下载失败: ${downloadError.message}`)
        }
        
        if (!videoData) {
          throw new Error('服务器返回空数据')
        }
        
        setLoadingProgress(80)
        console.log(`视频下载成功，大小: ${(videoData.size / 1024 / 1024).toFixed(2)}MB`)
        
        // 创建Blob URL
        const videoBlobUrl = URL.createObjectURL(videoData)
        console.log('创建Blob URL成功')
        
        setVideoUrl(videoBlobUrl)
        setLoadingProgress(100)
        setLoadingVideo(false)
        
        console.log('正常视频加载完成')
        return
        
      } catch (error: any) {
        console.warn(`尝试 ${attempt}/${maxRetries} 失败:`, error)
        
        if (attempt === maxRetries) {
          throw new Error(`经过 ${maxRetries} 次重试后仍失败: ${error.message}`)
        }
        
        // 等待后重试 (指数退避)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`${waitTime}ms后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  // 分块视频加载，带重试机制
  async function loadChunkedVideoWithRetry(chunkPaths: string[], maxRetries = 2) {
    console.log(`开始分块视频加载: ${chunkPaths.length} 个分块`)
    setChunkInfo({ current: 0, total: chunkPaths.length })
    setIsStreaming(false)
    
    const chunks: Blob[] = []
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setRetryCount(attempt - 1)
      console.log(`分块下载尝试 ${attempt}/${maxRetries}`)
      
      try {
        // 重置分块数组
        chunks.length = 0
        
        // 下载所有分块
        for (let i = 0; i < chunkPaths.length; i++) {
          console.log(`下载分块 ${i + 1}/${chunkPaths.length}`)
          
          const { data: chunkData, error: chunkError } = await supabase.storage
            .from('videos')
            .download(chunkPaths[i])
          
          if (chunkError) {
            throw new Error(`分块 ${i + 1} 下载失败: ${chunkError.message}`)
          }
          
          if (!chunkData) {
            throw new Error(`分块 ${i + 1} 返回空数据`)
          }
          
          chunks.push(chunkData)
          
          const progress = ((i + 1) / chunkPaths.length) * 90 // 最多90%
          setLoadingProgress(progress)
          setChunkInfo({ current: i + 1, total: chunkPaths.length })
          
          console.log(`分块 ${i + 1} 下载完成`)
        }
        
        // 合并所有分块
        console.log('开始合并分块...')
        const videoBlob = new Blob(chunks, { type: 'video/mp4' })
        const videoBlobUrl = URL.createObjectURL(videoBlob)
        
        console.log(`视频合并完成，总大小: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB`)
        
        setVideoUrl(videoBlobUrl)
        setLoadingProgress(100)
        setLoadingVideo(false)
        setChunkInfo(null)
        
        console.log('分块视频加载完成')
        return
        
      } catch (error: any) {
        console.warn(`分块下载尝试 ${attempt}/${maxRetries} 失败:`, error)
        
        if (attempt === maxRetries) {
          throw new Error(`经过 ${maxRetries} 次重试后仍失败: ${error.message}`)
        }
        
        const waitTime = Math.min(2000 * attempt, 5000)
        console.log(`${waitTime}ms后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!video) return

    if (password === video.access_password) {
      await loadVideoUrl(video.file_path, video.is_chunked, video.chunk_paths)
      setAuthenticated(true)
      setError('')
    } else {
      setError('密码错误，请重试')
    }
  }

  async function handleDownload() {
    if (!video) return

    setDownloading(true)
    try {
      if (video.is_chunked && video.chunk_paths && video.chunk_paths.length > 0) {
        // 下载分块视频
        console.log(`下载分块视频: ${video.chunk_paths.length} 个分块`)
        
        const chunks: Blob[] = []
        
        for (let i = 0; i < video.chunk_paths.length; i++) {
          const { data: chunkData, error: downloadError } = await supabase.storage
            .from('videos')
            .download(video.chunk_paths[i])
          
          if (downloadError || !chunkData) {
            throw new Error(`下载分块失败 (${i + 1}/${video.chunk_paths.length})`)
          }
          
          chunks.push(chunkData)
        }
        
        // 合并分块
        const videoBlob = new Blob(chunks, { type: 'video/mp4' })
        const downloadUrl = URL.createObjectURL(videoBlob)
        
        // 触发下载
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${video.title}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(downloadUrl)
      } else {
        // 下载正常视频
        const { data: videoData, error: downloadError } = await supabase.storage
          .from('videos')
          .download(video.file_path)
        
        if (downloadError || !videoData) {
          throw new Error('下载视频失败')
        }
        
        const downloadUrl = URL.createObjectURL(videoData)
        
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${video.title}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(downloadUrl)
      }
    } catch (error: any) {
      console.error('下载失败:', error)
      alert(`下载失败: ${error.message}`)
    } finally {
      setDownloading(false)
    }
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">正在加载视频...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error && !authenticated) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-white border-b border-neutral-100">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <img src="/logo.png" alt="华夏在线" className="h-10" />
            <h1 className="text-xl font-semibold text-neutral-900">线上培训系统</h1>
          </div>
        </div>
        <div className="flex items-center justify-center px-6 py-20">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-error-500 mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-neutral-900 mb-4">{error}</h1>
            <button
              onClick={() => loadVideo()}
              className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
            >
              重试加载
            </button>
            <p className="text-neutral-400 text-sm mt-4">
              如果问题持续存在，请检查网络连接或联系管理员
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 密码输入状态
  if (!authenticated && video?.access_password) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-white border-b border-neutral-100">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <img src="/logo.png" alt="华夏在线" className="h-10" />
            <h1 className="text-xl font-semibold text-neutral-900">线上培训系统</h1>
          </div>
        </div>
        <div className="flex items-center justify-center px-6 py-20">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl p-12 shadow-card">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-primary-500" />
              </div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-2 text-center">
                {video.title}
              </h1>
              <p className="text-neutral-400 text-center mb-8">
                该视频需要密码访问
              </p>

              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    访问密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all duration-250"
                    placeholder="请输入密码"
                    required
                  />
                </div>

                {error && (
                  <div className="text-sm text-error-500 bg-error-500/10 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-12 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-700 active:scale-98 transition-all duration-200"
                >
                  观看视频
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 主要播放界面
  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="华夏在线" className="h-10" />
          <h1 className="text-xl font-semibold text-white">线上培训系统</h1>
        </div>
      </div>
      
      {/* 加载进度覆盖层 */}
      {(loadingVideo || (!videoUrl && authenticated)) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="bg-neutral-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-neutral-700">
            <div className="flex flex-col items-center">
              <Loader className="w-16 h-16 text-primary-500 animate-spin mb-6" />
              <div className="w-full">
                <div className="h-3 bg-neutral-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-white text-center text-lg font-semibold mb-2">
                  加载中... {Math.round(loadingProgress)}%
                </p>
                {chunkInfo && (
                  <p className="text-neutral-400 text-center text-sm">
                    正在加载分片 {chunkInfo.current}/{chunkInfo.total}
                  </p>
                )}
                {retryCount > 0 && (
                  <p className="text-yellow-400 text-center text-sm mt-2">
                    第 {retryCount + 1} 次尝试...
                  </p>
                )}
                {!chunkInfo && retryCount === 0 && (
                  <p className="text-neutral-400 text-center text-sm">
                    请稍候，正在准备视频...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-white mb-8">{video?.title}</h1>
        
        {/* 视频播放器 */}
        {videoUrl && (
          <div className="bg-black rounded-xl overflow-hidden shadow-modal" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full select-none"
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              disablePictureInPicture
              style={{ pointerEvents: 'auto' }}
              onError={(e) => {
                console.error('视频播放错误:', e)
                const videoEl = e.currentTarget
                if (videoEl.error) {
                  console.error('视频错误代码:', videoEl.error.code)
                  console.error('视频错误信息:', videoEl.error.message)
                  setError(`视频播放错误: ${videoEl.error.message}`)
                }
              }}
              onLoadedMetadata={() => {
                console.log('视频元数据加载成功')
              }}
              onCanPlay={() => {
                console.log('视频可以开始播放')
              }}
            >
              您的浏览器不支持视频播放
            </video>
            {isStreaming && chunkInfo && (
              <div className="bg-neutral-800 px-4 py-2 text-sm text-neutral-300 text-center">
                后台加载中: {chunkInfo.current}/{chunkInfo.total} ({Math.round(loadingProgress)}%)
              </div>
            )}
          </div>
        )}
        
        {/* 占位符（视频加载时） */}
        {!videoUrl && authenticated && !loadingVideo && (
          <div className="bg-black rounded-xl overflow-hidden shadow-modal aspect-video flex items-center justify-center">
            <Loader className="w-12 h-12 text-primary-500 animate-spin" />
          </div>
        )}
        
        {/* 下载按钮 */}
        {video?.downloadable && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="h-12 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-700 active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  下载视频
                </>
              )}
            </button>
          </div>
        )}
        
        <p className="text-neutral-400 text-sm mt-6 text-center">
          上传于 {video && new Date(video.created_at).toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  )
}