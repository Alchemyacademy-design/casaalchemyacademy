import MemberLayout from "@/manus/components/MemberLayout";
import { Heart, MessageCircle, Trash2, Pin, Send, Hash, Users, Settings, Plus, ChevronDown, Search, ArrowLeft } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/manus/hooks/useAuth";

export default function Community() {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<string>("general");
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showChannelMenu, setShowChannelMenu] = useState(false);

  const { data: posts = [], refetch: refetchPosts } = trpc.community.posts.useQuery();
  const createPostMutation = trpc.community.createPost.useMutation();

  // Discord-style channels
  const channels = [
    { id: "general", name: "general", description: "General discussion" },
    { id: "questions", name: "questions", description: "Ask questions" },
    { id: "projects", name: "projects", description: "Share your projects" },
    { id: "inspiration", name: "inspiration", description: "Design inspiration" },
    { id: "resources", name: "resources", description: "Useful resources" },
  ];

  // Mock threads for selected channel
  const threads = [
    { id: 1, title: "Best color palettes for 2026", author: "Sarah M.", replies: 12, lastActive: "2 hours ago" },
    { id: 2, title: "How to use the 60-30-10 rule?", author: "John D.", replies: 8, lastActive: "4 hours ago" },
    { id: 3, title: "My living room redesign", author: "Emma L.", replies: 15, lastActive: "1 hour ago" },
    { id: 4, title: "Color drenching tips", author: "Alex K.", replies: 6, lastActive: "6 hours ago" },
  ];

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    try {
      await createPostMutation.mutateAsync({
        content: messageInput,
        title: "",
      });
      setMessageInput("");
      refetchPosts();
      toast.success("Message sent");
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  return (
    <MemberLayout>
      <div className="flex h-screen" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Sidebar - Channels */}
        <div className="hidden lg:flex flex-col w-64 border-r" style={{ borderColor: "var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
          {/* Server Header */}
          <div className="p-4 border-b" style={{ borderColor: "var(--aa-cream-dark)" }}>
            <button
              onClick={() => setShowChannelMenu(!showChannelMenu)}
              className="w-full flex items-center justify-between p-3 rounded"
              style={{ backgroundColor: "var(--aa-cream-dark)" }}
            >
              <span className="font-serif font-bold" style={{ color: "var(--aa-olive-dark)" }}>Alchemy Tribe</span>
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => {
                  setSelectedChannel(channel.id);
                  setSelectedThread(null);
                }}
                className="w-full text-left px-3 py-2 rounded transition-all text-sm"
                style={{
                  backgroundColor: selectedChannel === channel.id ? "var(--aa-gold)" : "transparent",
                  color: selectedChannel === channel.id ? "var(--aa-olive-dark)" : "var(--aa-text-mid)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div className="flex items-center gap-2">
                  <Hash size={14} />
                  <span>{channel.name}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Online Members */}
          <div className="p-4 border-t" style={{ borderColor: "var(--aa-cream-dark)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: "var(--aa-text-light)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>ONLINE</span>
            </div>
            <div className="space-y-2 text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#10b981" }} />
                <span>Sarah M.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#10b981" }} />
                <span>Emma L.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#10b981" }} />
                <span>John D.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Channel Header */}
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <div>
              <h2 className="font-serif text-lg" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                <Hash size={18} className="inline mr-2" />
                {channels.find((c) => c.id === selectedChannel)?.name}
              </h2>
              <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                {channels.find((c) => c.id === selectedChannel)?.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 text-sm rounded"
                style={{ backgroundColor: "var(--aa-cream-dark)", border: "none", fontFamily: "'DM Sans', sans-serif" }}
              />
              <button className="p-2 rounded" style={{ backgroundColor: "var(--aa-cream-dark)" }}>
                <Settings size={16} style={{ color: "var(--aa-text-mid)" }} />
              </button>
            </div>
          </div>

          {/* Messages/Threads Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {selectedThread ? (
              // Thread View
              <div>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="mb-4 text-sm flex items-center gap-1"
                  style={{ color: "var(--aa-gold)" }}
                >
                  <ArrowLeft size={14} />
                  Back to #{selectedChannel}
                </button>
                <h3 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  Best color palettes for 2026
                </h3>
                <div className="space-y-4">
                  <div className="p-4" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "var(--aa-gold)" }} />
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>Sarah M.</p>
                        <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>2 hours ago</p>
                      </div>
                    </div>
                    <p style={{ color: "var(--aa-text-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      I've been experimenting with warm terracotta tones mixed with jewel accents. The combination is stunning!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Channel Messages
              <div className="space-y-4">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThread(thread.id)}
                    className="w-full text-left p-4 rounded transition-all hover:shadow-md"
                    style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-serif font-bold" style={{ color: "var(--aa-olive-dark)" }}>{thread.title}</h3>
                      <span className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                        {thread.lastActive}
                      </span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                      by {thread.author}
                    </p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      <MessageCircle size={14} />
                      <span>{thread.replies} replies</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t" style={{ borderColor: "var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={`Message #${selectedChannel}...`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 px-4 py-2 rounded text-sm"
                style={{ backgroundColor: "var(--aa-cream-dark)", border: "none", fontFamily: "'DM Sans', sans-serif" }}
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 rounded transition-all"
                style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: "var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
              ← Back
            </a>
            <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
              Exit
            </a>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
