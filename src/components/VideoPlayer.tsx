import React from 'react'
import { BookmarkIcon, ClosedCaptionIcon } from '@heroicons/react/24/outline'

interface VideoPlayerProps {
  currentTime: number
  hasCaptions: boolean
  captionsEnabled: boolean
  handleSaveBookmark: (time: number) => void
  toggleCaptions: () => void
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  currentTime,
  hasCaptions,
  captionsEnabled,
  handleSaveBookmark,
  toggleCaptions,
}) => {
  return (
    <div className="video-player">
      {/* Bookmark shortcut area */}
      <div className="flex items-center gap-2">
        <button
          className="bookmark-save-btn"
          onClick={() => handleSaveBookmark(currentTime)}
          title="Save bookmark (B)"
        >
          <BookmarkIcon className="h-5 w-5" />
          <span>Bookmark</span>
        </button>

        <div className="text-sm text-gray-500">
          Press <kbd>B</kbd> to quickly save a bookmark
        </div>
      </div>

      {/* Controls section */}
      <div className="video-controls-right">
        {hasCaptions && (
          <button
            onClick={toggleCaptions}
            className={`control-btn ${captionsEnabled ? 'active' : ''}`}
            title="Toggle captions (C)"
          >
            <ClosedCaptionIcon className="h-5 w-5" />
          </button>
        )}

        <button
          className="control-btn"
          onClick={() => handleSaveBookmark(currentTime)}
          title="Save bookmark (B)"
        >
          <BookmarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
