import { Sparkles, Image, Video, FileText, Wand2 } from 'lucide-react';

export function AIAgentsContent() {
  const features = [
    {
      icon: FileText,
      title: 'AI-Powered Copy Generation',
      description: 'Generate compelling marketing copy, email templates, and social media posts',
    },
    {
      icon: Image,
      title: 'Image Creation & Editing',
      description: 'Create custom images and graphics with AI-powered design tools',
    },
    {
      icon: Video,
      title: 'Video Script Writing',
      description: 'Generate video scripts, storyboards, and content outlines',
    },
    {
      icon: Wand2,
      title: 'Content Optimization',
      description: 'Optimize existing content for SEO, readability, and engagement',
    },
  ];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-2xl text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-purple-400" />
        </div>

        <h2 className="text-3xl font-bold text-white mb-4">Content AI Coming Soon</h2>
        <p className="text-lg text-slate-400 mb-8">
          Create amazing content with AI-powered tools for copy, images, and video.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-6 bg-slate-800 border border-slate-700 rounded-lg text-left"
              >
                <div className="p-2 bg-purple-500/10 rounded-lg w-fit mb-3">
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <button
          disabled
          className="px-6 py-3 bg-slate-700 text-slate-500 rounded-lg font-medium cursor-not-allowed"
        >
          Coming Soon
        </button>

        <p className="text-sm text-slate-500 mt-4">
          This feature is currently in development. Stay tuned!
        </p>
      </div>
    </div>
  );
}
