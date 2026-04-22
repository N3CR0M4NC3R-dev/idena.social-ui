import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Poster } from './logic/asyncUtils';
import type { DirectMessage, MessageKeyState } from './logic/messages';
import Messages from './Messages';

let mockOutletContext: unknown;

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');

    return {
        ...actual,
        useOutletContext: () => mockOutletContext,
    };
});

type MessagesOutletContext = {
    makePostsWith: string;
    nodeAvailable: boolean;
    viewOnlyNode: boolean;
    postersAddress: string;
    posters: Record<string, Poster>;
    messages: Record<string, DirectMessage>;
    messageKeyState: MessageKeyState;
    unlockMessagesHandler: (password: string) => Promise<void>;
    lockMessagesHandler: () => void;
    submitDirectMessageHandler: (recipient: string, plaintext: string) => Promise<void>;
    lookupPosterHandler: (address: string) => Promise<Poster>;
    submittingMessage: string;
    scanningPastBlocks: boolean;
    noMorePastBlocks: boolean;
    inputPostDisabled: boolean;
};

function createContext(overrides: Partial<MessagesOutletContext> = {}): MessagesOutletContext {
    return {
        makePostsWith: 'rpc',
        nodeAvailable: true,
        viewOnlyNode: false,
        postersAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        posters: {},
        messages: {},
        messageKeyState: { status: 'locked' },
        unlockMessagesHandler: vi.fn().mockResolvedValue(undefined),
        lockMessagesHandler: vi.fn(),
        submitDirectMessageHandler: vi.fn().mockResolvedValue(undefined),
        lookupPosterHandler: vi.fn().mockResolvedValue({
            address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            stake: '0',
            age: 0,
            pubkey: '',
            state: 'Human',
        }),
        submittingMessage: '',
        scanningPastBlocks: false,
        noMorePastBlocks: false,
        inputPostDisabled: false,
        ...overrides,
    };
}

describe('Messages route', () => {
    it('shows the RPC-only blocking state when the app is not in RPC mode', () => {
        mockOutletContext = createContext({ makePostsWith: 'idena-app' });

        render(<Messages />);

        expect(screen.getByText(/Direct messages are RPC-only in v1/i)).toBeTruthy();
    });

    it('keeps sending disabled when the recipient identity has no public key', async () => {
        const user = userEvent.setup();
        const lookupPosterHandler = vi.fn().mockResolvedValue({
            address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            stake: '0',
            age: 0,
            pubkey: '',
            state: 'Human',
        });

        mockOutletContext = createContext({
            messageKeyState: {
                status: 'unlocked',
                unlockedAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            lookupPosterHandler,
        });

        render(<Messages />);

        await user.type(screen.getByPlaceholderText('0x...'), '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
        await user.click(screen.getByRole('button', { name: 'Open' }));

        await waitFor(() => {
            expect(screen.getByText('This identity has no public key; encrypted DMs are disabled.')).toBeTruthy();
        });

        const sendButton = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
        expect(sendButton.disabled).toBe(true);
        expect(lookupPosterHandler).toHaveBeenCalledWith('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    });
});
