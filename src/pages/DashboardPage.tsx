import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { UploadZone } from '@/components/UploadZone'
import { VideoCard } from '@/components/VideoCard'
import { VideoSettingsModal } from '@/components/VideoSettingsModal'
import { Video, supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)

  useEffect(() => {
    if (user) {
      loadVideos()
    }
  }, [user])

  async function loadVideos() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVideos(data || [])
    } catch (error) {
      console.error('Error loading videos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 sm:px-12 py-12">
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">
            上传视频
          </h2>
          <UploadZone onUploadComplete={loadVideos} />
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">
            我的视频
          </h2>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-neutral-400 text-base">还没有上传视频</p>
              <p className="text-neutral-400 text-sm mt-2">上传第一个视频开始分享</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onDelete={loadVideos}
                  onEdit={setEditingVideo}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {editingVideo && (
        <VideoSettingsModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSave={loadVideos}
        />
      )}
    </div>
  )
}
