import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import './index.css';
import App from './App.tsx';
import LatestPosts from './LatestPosts.tsx';
import Address from './Address.tsx';
import ScrollToTop from './components/ScrollToTop.tsx';
import PostOutlet from './PostOutlet.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <ScrollToTop />
            <Routes>
                <Route  path="/" element={<App />}>
                    <Route index element={<LatestPosts />} />
                    <Route path="/address/:address" element={<Address />} />
                    <Route path="/post/:postId" element={<PostOutlet />} />
                </Route>
            </Routes>
        </BrowserRouter>
    </StrictMode>
);
