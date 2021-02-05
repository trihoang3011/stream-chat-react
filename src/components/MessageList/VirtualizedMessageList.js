// @ts-check
import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Virtuoso } from 'react-virtuoso';

import { smartRender } from '../../utils';
import MessageNotification from './MessageNotification';
import { ChannelContext, TranslationContext } from '../../context';
import { EventComponent } from '../EventComponent';
import { LoadingIndicator as DefaultLoadingIndicator } from '../Loading';
import { EmptyStateIndicator as DefaultEmptyStateIndicator } from '../EmptyStateIndicator';
import {
  FixedHeightMessage,
  MessageDeleted as DefaultMessageDeleted,
} from '../Message';

/**
 * VirtualizedMessageList - This component renders a list of messages in a virtual list. Its a consumer of [Channel Context](https://getstream.github.io/stream-chat-react/#channel)
 * It is pretty fast for rendering thousands of messages but it needs its Message componet to have fixed height
 * @example ../../docs/VirtualizedMessageList.md
 * @type {React.FC<import('types').VirtualizedMessageListInternalProps>}
 */
const VirtualizedMessageList = ({
  client,
  messages,
  loadMore,
  hasMore,
  loadingMore,
  messageLimit = 100,
  overscan = 200,
  shouldGroupByUser = false,
  customMessageRenderer,
  scrollSeekPlaceHolder,
  Message = FixedHeightMessage,
  MessageSystem = EventComponent,
  MessageDeleted = DefaultMessageDeleted,
  TypingIndicator = null,
  LoadingIndicator = DefaultLoadingIndicator,
  EmptyStateIndicator = DefaultEmptyStateIndicator,
}) => {
  const { t } = useContext(TranslationContext);
  const [newMessagesNotification, setNewMessagesNotification] = useState(false);

  const virtuoso = useRef(
    /** @type {import('react-virtuoso').VirtuosoHandle | undefined} */ (undefined),
  );
  const mounted = useRef(false);
  const atBottom = useRef(false);
  const lastMessageId = useRef('');

  useEffect(() => {
    /* handle scrolling behavior for new messages */
    if (!messages.length) return;

    const lastMessage = messages[messages.length - 1];
    const prevMessageId = lastMessageId.current;
    lastMessageId.current = lastMessage.id || ''; // update last message id

    /* do nothing if new messages are loaded from top(loadMore)  */
    if (lastMessage.id === prevMessageId) return;

    /* if list is already at the bottom return, followOutput will do the job */
    if (atBottom.current) return;

    /* if the new message belongs to current user scroll to bottom */
    if (lastMessage.user?.id === client.userID) {
      setTimeout(() => virtuoso.current?.scrollToIndex(messages.length));
      return;
    }

    /* otherwise just show newMessage notification  */
    setNewMessagesNotification(true);
  }, [client.userID, messages]);

  useEffect(() => {
    /*
     * scroll to bottom when list is rendered for the first time
     * this is due to initialTopMostItemIndex buggy behavior leading to empty screen
     */
    if (mounted.current) return;
    mounted.current = true;
    if (messages.length && virtuoso.current) {
      virtuoso.current.scrollToIndex(messages.length - 1);
    }
  }, [messages.length]);

  const [numItemsPrepended, setNumItemsPrepended] = useState(0);
  const messageRenderer = useCallback(
    (messageList, virtuosoIndex) => {
      const streamMessagesIndex = virtuosoIndex + numItemsPrepended;
      // use custom renderer supplied by client if present and skip the rest
      if (customMessageRenderer)
        return customMessageRenderer(messageList, streamMessagesIndex);

      const message = messageList[streamMessagesIndex];
      if (!message) return <div style={{ height: '1px' }}></div>; // returning null or zero height breaks the virtuoso

      if (message.type === 'channel.event' || message.type === 'system')
        return <MessageSystem message={message} />;

      if (message.deleted_at)
        return smartRender(MessageDeleted, { message }, null);

      return (
        <Message
          message={message}
          groupedByUser={
            shouldGroupByUser &&
            streamMessagesIndex > 0 &&
            message.user.id === messageList[streamMessagesIndex - 1].user.id
          }
        />
      );
    },
    [
      MessageDeleted,
      customMessageRenderer,
      shouldGroupByUser,
      numItemsPrepended,
    ],
  );

  const virtuosoComponents = useMemo(() => {
    const EmptyPlaceholder = () => <EmptyStateIndicator listType="message" />;
    const Header = () =>
      loadingMore ? (
        <div className="str-chat__virtual-list__loading">
          <LoadingIndicator size={20} />
        </div>
      ) : (
        <></>
      );
    const Footer = () =>
      TypingIndicator ? <TypingIndicator avatarSize={24} /> : <></>;

    return {
      EmptyPlaceholder,
      ScrollSeekPlaceHolder: scrollSeekPlaceHolder,
      Header,
      Footer,
    };
  }, [
    EmptyStateIndicator,
    scrollSeekPlaceHolder,
    loadingMore,
    TypingIndicator,
  ]);

  return (
    <div className="str-chat__virtual-list">
      <Virtuoso
        // @ts-ignore
        ref={virtuoso}
        totalCount={messages.length}
        overscan={overscan}
        followOutput={true}
        itemContent={(i) => messageRenderer(messages, i)}
        components={virtuosoComponents}
        firstItemIndex={-numItemsPrepended}
        startReached={() => {
          // mounted.current prevents immediate loadMore on first render
          if (mounted.current && hasMore) {
            loadMore(messageLimit).then((newItems) =>
              setNumItemsPrepended((old) => old + newItems),
            );
          }
        }}
        atBottomStateChange={(isAtBottom) => {
          atBottom.current = isAtBottom;
          if (isAtBottom && newMessagesNotification)
            setNewMessagesNotification(false);
        }}
      />

      <div className="str-chat__list-notifications">
        <MessageNotification
          showNotification={newMessagesNotification}
          onClick={() => {
            if (virtuoso.current)
              virtuoso.current.scrollToIndex(messages.length);
            setNewMessagesNotification(false);
          }}
        >
          {t('New Messages!')}
        </MessageNotification>
      </div>
    </div>
  );
};

// TODO: fix the types here when everything converted to proper TS
/**
 * @param {import("types").VirtualizedMessageListProps} props
 * @returns {React.ElementType<import("types").VirtualizedMessageListInternalProps>}
 */
export default function VirtualizedMessageListWithContext(props) {
  // @ts-ignore
  return (
    <ChannelContext.Consumer>
      {(
        /* {Required<Pick<import('types').ChannelContextValue, 'client' | 'messages' | 'loadMore' | 'hasMore' | 'loadingMore'>>} */ context,
      ) => (
        <VirtualizedMessageList
          client={context.client}
          // @ts-ignore
          messages={context.messages}
          // @ts-ignore
          loadMore={context.loadMore}
          // @ts-ignore
          hasMore={context.hasMore}
          // @ts-ignore
          loadingMore={context.loadingMore}
          {...props}
        />
      )}
    </ChannelContext.Consumer>
  );
}
