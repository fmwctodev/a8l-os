import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  MessageSquare,
} from 'lucide-react';
import type {
  SocialProvider,
  SocialPlatformOptions,
  GoogleBusinessPostType,
  GoogleBusinessCTAType,
  FacebookPostType,
  InstagramPostFormat,
  LinkedInVisibility,
  YouTubePrivacy,
  TikTokPrivacyLevel,
} from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
  reddit: MessageSquare,
};

const GBP_POST_TYPES: { value: GoogleBusinessPostType; label: string }[] = [
  { value: 'STANDARD', label: "What's New" },
  { value: 'EVENT', label: 'Event' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'ALERT', label: 'Call to Action' },
];

const GBP_CTA_BUTTONS: { value: GoogleBusinessCTAType; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order Online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'CALL', label: 'Call Now' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'VISIT', label: 'Visit Us' },
];

interface PlatformAdvancedOptionsProps {
  platforms: SocialProvider[];
  options: SocialPlatformOptions;
  onChange: (options: SocialPlatformOptions) => void;
}

export function PlatformAdvancedOptions({
  platforms,
  options,
  onChange,
}: PlatformAdvancedOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  if (platforms.length === 0) return null;

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  const updateOption = <K extends keyof SocialPlatformOptions>(
    key: K,
    value: SocialPlatformOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-sm font-medium text-gray-700">Advanced options</span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100">
          {platforms.includes('google_business') && (
            <PlatformSection
              provider="google_business"
              isExpanded={expandedPlatforms.google_business !== false}
              onToggle={() => togglePlatform('google_business')}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={options.google_business?.postType || 'STANDARD'}
                    onChange={(e) =>
                      updateOption('google_business', {
                        ...options.google_business,
                        postType: e.target.value as GoogleBusinessPostType,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {GBP_POST_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Select button label</label>
                  <select
                    value={options.google_business?.ctaButton || ''}
                    onChange={(e) =>
                      updateOption('google_business', {
                        ...options.google_business,
                        postType: options.google_business?.postType || 'STANDARD',
                        ctaButton: e.target.value as GoogleBusinessCTAType,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select button label</option>
                    {GBP_CTA_BUTTONS.map((cta) => (
                      <option key={cta.value} value={cta.value}>
                        {cta.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {options.google_business?.ctaButton && (
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">Button URL</label>
                  <input
                    type="url"
                    value={options.google_business?.ctaUrl || ''}
                    onChange={(e) =>
                      updateOption('google_business', {
                        ...options.google_business,
                        postType: options.google_business?.postType || 'STANDARD',
                        ctaUrl: e.target.value,
                      })
                    }
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </PlatformSection>
          )}

          {platforms.includes('facebook') && (
            <PlatformSection
              provider="facebook"
              isExpanded={expandedPlatforms.facebook !== false}
              onToggle={() => togglePlatform('facebook')}
            >
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Post this as <span className="text-gray-400 text-xs ml-1">?</span>
                </label>
                <div className="flex items-center gap-4">
                  {(['feed', 'reel', 'story'] as FacebookPostType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="facebook-post-type"
                        value={type}
                        checked={(options.facebook?.postType || 'feed') === type}
                        onChange={(e) =>
                          updateOption('facebook', {
                            postType: e.target.value as FacebookPostType,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PlatformSection>
          )}

          {platforms.includes('instagram') && (
            <PlatformSection
              provider="instagram"
              isExpanded={expandedPlatforms.instagram !== false}
              onToggle={() => togglePlatform('instagram')}
            >
              <div>
                <label className="block text-sm text-gray-600 mb-2">Post format</label>
                <div className="flex items-center gap-4">
                  {(['feed', 'reel'] as InstagramPostFormat[]).map((format) => (
                    <label key={format} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="instagram-format"
                        value={format}
                        checked={(options.instagram?.format || 'feed') === format}
                        onChange={(e) =>
                          updateOption('instagram', {
                            format: e.target.value as InstagramPostFormat,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">
                        {format === 'feed' ? 'Feed Post' : 'Reel'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </PlatformSection>
          )}

          {platforms.includes('linkedin') && (
            <PlatformSection
              provider="linkedin"
              isExpanded={expandedPlatforms.linkedin !== false}
              onToggle={() => togglePlatform('linkedin')}
            >
              <div>
                <label className="block text-sm text-gray-600 mb-1">Visibility</label>
                <select
                  value={options.linkedin?.visibility || 'PUBLIC'}
                  onChange={(e) =>
                    updateOption('linkedin', {
                      ...options.linkedin,
                      visibility: e.target.value as LinkedInVisibility,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PUBLIC">Anyone (Public)</option>
                  <option value="CONNECTIONS">Connections Only</option>
                </select>
              </div>
            </PlatformSection>
          )}

          {platforms.includes('youtube') && (
            <PlatformSection
              provider="youtube"
              isExpanded={expandedPlatforms.youtube !== false}
              onToggle={() => togglePlatform('youtube')}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={options.youtube?.title || ''}
                    onChange={(e) =>
                      updateOption('youtube', {
                        ...options.youtube,
                        videoType: options.youtube?.videoType || 'standard',
                        title: e.target.value,
                        privacy: options.youtube?.privacy || 'public',
                      })
                    }
                    maxLength={100}
                    placeholder="Video title (max 100 characters)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Description</label>
                  <textarea
                    value={options.youtube?.description || ''}
                    onChange={(e) =>
                      updateOption('youtube', {
                        ...options.youtube,
                        videoType: options.youtube?.videoType || 'standard',
                        title: options.youtube?.title || '',
                        privacy: options.youtube?.privacy || 'public',
                        description: e.target.value,
                      })
                    }
                    placeholder="Video description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Privacy</label>
                  <select
                    value={options.youtube?.privacy || 'public'}
                    onChange={(e) =>
                      updateOption('youtube', {
                        ...options.youtube,
                        videoType: options.youtube?.videoType || 'standard',
                        title: options.youtube?.title || '',
                        privacy: e.target.value as YouTubePrivacy,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </PlatformSection>
          )}

          {platforms.includes('tiktok') && (
            <PlatformSection
              provider="tiktok"
              isExpanded={expandedPlatforms.tiktok !== false}
              onToggle={() => togglePlatform('tiktok')}
            >
              <div className="space-y-3">
                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  TikTok requires video content only
                </p>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Privacy Level</label>
                  <select
                    value={options.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE'}
                    onChange={(e) =>
                      updateOption('tiktok', {
                        ...options.tiktok,
                        privacyLevel: e.target.value as TikTokPrivacyLevel,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PUBLIC_TO_EVERYONE">Public</option>
                    <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                    <option value="SELF_ONLY">Private</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.tiktok?.allowComments !== false}
                      onChange={(e) =>
                        updateOption('tiktok', {
                          ...options.tiktok,
                          privacyLevel: options.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE',
                          allowComments: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Allow comments</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.tiktok?.allowDuet !== false}
                      onChange={(e) =>
                        updateOption('tiktok', {
                          ...options.tiktok,
                          privacyLevel: options.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE',
                          allowDuet: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Allow Duet</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.tiktok?.allowStitch !== false}
                      onChange={(e) =>
                        updateOption('tiktok', {
                          ...options.tiktok,
                          privacyLevel: options.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE',
                          allowStitch: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Allow Stitch</span>
                  </label>
                </div>
              </div>
            </PlatformSection>
          )}
        </div>
      )}
    </div>
  );
}

function PlatformSection({
  provider,
  isExpanded,
  onToggle,
  children,
}: {
  provider: SocialProvider;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = PROVIDER_ICONS[provider];
  const labels: Record<SocialProvider, string> = {
    facebook: 'Facebook options',
    instagram: 'Instagram options',
    linkedin: 'LinkedIn options',
    google_business: 'Google Business Profile options',
    tiktok: 'TikTok options',
    youtube: 'YouTube options',
  };

  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-700">{labels[provider]}</span>
      </button>

      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
