import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  MoreHorizontal,
  ThumbsUp,
  MessageCircle,
  Share2,
  Heart,
  Send,
  Bookmark,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import type { SocialAccount, SocialProvider, SocialPostMedia } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  google_business: '#4285F4',
  tiktok: '#000000',
  youtube: '#FF0000',
};

interface PostPreviewPanelProps {
  accounts: SocialAccount[];
  selectedIds: string[];
  body: string;
  media: SocialPostMedia[];
  activeTab: SocialProvider | 'all';
  onTabChange: (tab: SocialProvider | 'all') => void;
}

export function PostPreviewPanel({
  accounts,
  selectedIds,
  body,
  media,
  activeTab,
  onTabChange,
}: PostPreviewPanelProps) {
  const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id));
  const uniqueProviders = [...new Set(selectedAccounts.map((a) => a.provider))];

  const filteredAccounts =
    activeTab === 'all'
      ? selectedAccounts
      : selectedAccounts.filter((a) => a.provider === activeTab);

  if (selectedAccounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Post Preview</h3>
        <div className="border-b border-gray-200 pb-2 mb-6">
          <button className="px-3 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
            All
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-gray-300" />
              </div>
            </div>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
              <Linkedin className="w-5 h-5 text-gray-300" />
            </div>
            <div className="absolute top-2 -right-2">
              <Music2 className="w-5 h-5 text-gray-300" />
            </div>
            <div className="absolute top-1/2 -left-3 -translate-y-1/2">
              <Facebook className="w-5 h-5 text-gray-300" />
            </div>
            <div className="absolute bottom-2 -right-1">
              <Instagram className="w-5 h-5 text-gray-300" />
            </div>
            <div className="absolute bottom-0 left-1/4">
              <MapPin className="w-5 h-5 text-gray-300" />
            </div>
          </div>
          <p className="text-sm text-gray-500">Select a social account to preview your post here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Post Preview</h3>

      <div className="flex items-center gap-1 border-b border-gray-200 pb-2 mb-4 overflow-x-auto">
        <button
          onClick={() => onTabChange('all')}
          className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        {uniqueProviders.map((provider) => {
          const Icon = PROVIDER_ICONS[provider];
          const color = PROVIDER_COLORS[provider];
          return (
            <button
              key={provider}
              onClick={() => onTabChange(provider)}
              className={`p-2 transition-colors ${
                activeTab === provider
                  ? 'border-b-2'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={activeTab === provider ? { borderColor: color, color } : {}}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {filteredAccounts.map((account) => (
          <PreviewCard
            key={account.id}
            account={account}
            body={body}
            media={media}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewCard({
  account,
  body,
  media,
}: {
  account: SocialAccount;
  body: string;
  media: SocialPostMedia[];
}) {
  const Icon = PROVIDER_ICONS[account.provider];
  const color = PROVIDER_COLORS[account.provider];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="relative">
            {account.profile_image_url ? (
              <img
                src={account.profile_image_url}
                alt={account.display_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color + '20' }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
            )}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
              style={{ backgroundColor: color }}
            >
              <Icon className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <div className="font-medium text-sm text-gray-900">{account.display_name}</div>
            <div className="text-xs text-gray-400">JUST NOW</div>
          </div>
        </div>
        <button className="p-1 text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {media.length > 0 ? (
        <div className={`${media.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'} bg-gray-100`}>
          {media.slice(0, 4).map((item, idx) => (
            <div key={item.id || idx} className="relative aspect-square">
              {item.type === 'video' ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <Video className="w-8 h-8 text-white" />
                </div>
              ) : (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              {idx === 3 && media.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+{media.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="aspect-video bg-gray-50 flex flex-col items-center justify-center text-gray-400">
          <ImageIcon className="w-8 h-8 mb-2" />
          <span className="text-sm">
            {account.provider === 'facebook'
              ? 'Make your post stand out with photos or a video or a GIF'
              : 'Make your post stand out with a photo'}
          </span>
        </div>
      )}

      {body && (
        <div className="p-3">
          <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-4">{body}</p>
        </div>
      )}

      <PlatformEngagement provider={account.provider} />
    </div>
  );
}

function PlatformEngagement({ provider }: { provider: SocialProvider }) {
  switch (provider) {
    case 'facebook':
      return (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <ThumbsUp className="w-4 h-4" />
            Like
          </button>
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <MessageCircle className="w-4 h-4" />
            Comment
          </button>
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      );

    case 'instagram':
      return (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button className="text-gray-700 hover:text-red-500">
              <Heart className="w-5 h-5" />
            </button>
            <button className="text-gray-700 hover:text-gray-900">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="text-gray-700 hover:text-gray-900">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <button className="text-gray-700 hover:text-gray-900">
            <Bookmark className="w-5 h-5" />
          </button>
        </div>
      );

    case 'linkedin':
      return (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <ThumbsUp className="w-4 h-4" />
            Like
          </button>
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <MessageCircle className="w-4 h-4" />
            Comment
          </button>
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <Share2 className="w-4 h-4" />
            Repost
          </button>
          <button className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700">
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      );

    default:
      return (
        <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 text-gray-400 text-sm">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
      );
  }
}
