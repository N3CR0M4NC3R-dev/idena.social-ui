import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import './index.css';
import App from './App.tsx';
import LatestPosts from './LatestPosts.tsx';
import Profile from './Profile.tsx';
import ScrollToTop from './components/ScrollToTop.tsx';
import PostOutlet from './PostOutlet.tsx';
import Settings from './Settings.tsx';
import Messages from './Messages.tsx';
import ConversationOutlet from './ConversationOutlet.tsx';
import ProfilePosts from './ProfilePosts.tsx';
import ProfileReplies from './ProfileReplies.tsx';
import ProfileComments from './ProfileComments.tsx';
import ProfileLikes from './ProfileLikes.tsx';
import ProfileTips from './ProfileTips.tsx';
import ProfileMedia from './ProfileMedia.tsx';
import PostActivity from './PostActivity.tsx';
import Topics from './Topics.tsx';
import Moderation from './Moderation.tsx';
import ModerationReports from './ModerationReports.tsx';
import ModerationBanned from './ModerationBanned.tsx';
import ModerationLog from './ModerationLog.tsx';
import ModerationModerators from './ModerationModerators.tsx';
import ModerationCleanup from './ModerationCleanup.tsx';
import ModerationVouches from './ModerationVouches.tsx';
import { initTheme } from './logic/theme.ts';

initTheme();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<App />}>
                    <Route index element={<LatestPosts />} />
                    <Route path="/topics" element={<Topics />} />
                    <Route path="/topics/:topic" element={<LatestPosts />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/postactivity" element={<PostActivity />} />
                    <Route path="/moderation" element={<Moderation />}>
                        <Route index element={<ModerationReports />} />
                        <Route path="/moderation/banned" element={<ModerationBanned />} />
                        <Route path="/moderation/log" element={<ModerationLog />} />
                        <Route path="/moderation/moderators" element={<ModerationModerators />} />
                        <Route path="/moderation/vouches" element={<ModerationVouches />} />
                        <Route path="/moderation/banned/:address" element={<ModerationCleanup />} />
                    </Route>
                    <Route path="/post/:postId" element={<PostOutlet />} />
                    <Route path="/conversation/:conversationKey" element={<ConversationOutlet />} />
                    <Route path="/profile/:address" element={<Profile />}>
                        <Route index element={<ProfilePosts />} />
                        <Route path="/profile/:address/replies" element={<ProfileReplies />} />
                        <Route path="/profile/:address/comments" element={<ProfileComments />} />
                        <Route path="/profile/:address/likes" element={<ProfileLikes />} />
                        <Route path="/profile/:address/tips" element={<ProfileTips />} />
                        <Route path="/profile/:address/media" element={<ProfileMedia />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    </StrictMode>
);
