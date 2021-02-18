import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';
// @ts-expect-error
import DefaultEmoji from 'emoji-mart/dist-modern/components/emoji/nimble-emoji';
// @ts-expect-error
import DefaultEmojiIndex from 'emoji-mart/dist-modern/utils/emoji-index/nimble-emoji-index';
// @ts-expect-error
import DefaultEmojiPicker from 'emoji-mart/dist-modern/components/picker/nimble-picker';
import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import {
  logChatPromiseExecution,
  Message,
  MessageResponse,
  Channel as StreamChannel,
  StreamChat,
  UpdatedMessage,
} from 'stream-chat';
import { v4 as uuidv4 } from 'uuid';

import {
  channelReducer,
  ChannelStateReducer,
  initialState,
} from './channelState';
import { commonEmoji, defaultMinimalEmojis, emojiSetDef } from './emojiData';

import useEditMessageHandler from './hooks/useEditMessageHandler';
import useIsMounted from './hooks/useIsMounted';
import useMentionsHandlers, {
  OnMentionAction,
} from './hooks/useMentionsHandlers';

import { Attachment as DefaultAttachment } from '../Attachment';
import {
  LoadingErrorIndicator as DefaultLoadingErrorIndicator,
  LoadingIndicator as DefaultLoadingIndicator,
} from '../Loading';
import { MessageSimple } from '../Message';

import {
  ChannelContextValue,
  ChannelProvider,
  MessageToSend,
  useChatContext,
  useTranslationContext,
} from '../../context';
import defaultEmojiData from '../../stream-emoji.json';

import type {
  Data as EmojiMartData,
  NimbleEmojiIndex,
  NimbleEmojiProps,
  NimblePickerProps,
} from 'emoji-mart';

import type {
  DefaultAttachmentType,
  DefaultChannelType,
  DefaultCommandType,
  DefaultEventType,
  DefaultMessageType,
  DefaultReactionType,
  DefaultUserType,
  UnknownType,
} from '../../../types/types';

export type ChannelProps<
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends UnknownType = DefaultUserType
> = {
  /** List of accepted file types */
  acceptedFiles?: string[];
  /**
   * Attachment UI component to display attachment in individual message.
   *
   * Defaults to and accepts same props as: [Attachment](https://github.com/GetStream/stream-chat-react/blob/master/src/components/Attachment.js)
   * */
  Attachment?: React.ComponentType<unknown>; // TODO - add generic when Attachment pr merged
  /** The connected and active channel */
  channel?: StreamChannel<At, Ch, Co, Ev, Me, Re, Us>;
  /**
   * Override mark channel read request (Advanced usage only)
   *
   * @param {Channel} channel object
   * */
  doMarkReadRequest?: (
    channel: StreamChannel<At, Ch, Co, Ev, Me, Re, Us>,
  ) => Promise<MessageResponse<At, Ch, Co, Me, Re, Us>> | void;
  /** Override send message request (Advanced usage only)
   *
   * @param {String} channelId full channel ID in format of `type:id`
   * @param {Object} message
   */
  doSendMessageRequest?: (
    channelId: string,
    message: MessageToSend<At, Ch, Co, Me, Re, Us>, // TODO - double check message type
  ) => ReturnType<
    StreamChannel<At, Ch, Co, Ev, Me, Re, Us>['sendMessage']
  > | void;
  /** Override update(edit) message request (Advanced usage only)
   *
   * @param {String} channelId full channel ID in format of `type:id`
   * @param {Object} updatedMessage
   */
  doUpdateMessageRequest?: (
    cid: string,
    updatedMessage: UpdatedMessage<At, Ch, Co, Me, Re, Us>, // TODO - double check message type
  ) => ReturnType<StreamChat<At, Ch, Co, Ev, Me, Re, Us>['updateMessage']>;
  /**
   * Optional component to override default NimbleEmoji from emoji-mart
   */
  Emoji?: React.ComponentType<NimbleEmojiProps>;
  /**
   * Optional prop to override default facebook.json emoji data set from emoji-mart
   */
  emojiData?: EmojiMartData;
  /**
   * Optional component to override default NimbleEmojiIndex from emoji-mart
   */
  EmojiIndex?: NimbleEmojiIndex;
  /**
   * Optional component to override default NimblePicker from emoji-mart
   */
  EmojiPicker?: React.ComponentType<NimblePickerProps>;
  /**
   * Empty channel UI component. This will be shown on the screen if there is no active channel.
   *
   * Defaults to null which skips rendering the Channel
   *
   * */
  EmptyPlaceholder?: React.ReactElement;
  /**
   * Error indicator UI component. This will be shown on the screen if channel query fails.
   *
   * Defaults to and accepts same props as: [LoadingErrorIndicator](https://getstream.github.io/stream-chat-react/#loadingerrorindicator)
   *
   * */
  LoadingErrorIndicator?: React.ComponentType<unknown>; // TODO - add generic when ChannelList pr merged
  /**
   * Loading indicator UI component. This will be shown on the screen until the messages are
   * being queried from channel. Once the messages are loaded, loading indicator is removed from the screen
   * and replaced with children of the Channel component.
   *
   * Defaults to and accepts same props as: [LoadingIndicator](https://github.com/GetStream/stream-chat-react/blob/master/src/components/LoadingIndicator.js)
   */
  LoadingIndicator?: React.ComponentType<unknown>; // TODO - add generic when ChannelList pr merged
  /** Maximum number of attachments allowed per message */
  maxNumberOfFiles?: number;
  /**
   * Message UI component to display a message in message list.
   *
   * Available built-in components (also accepts the same props as):
   *
   * 1. [MessageSimple](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageSimple.js) (default)
   * 2. [MessageTeam](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageTeam.js)
   * 3. [MessageLivestream](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageLivestream.js)
   * 3. [MessageCommerce](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageCommerce.js)
   *
   * */
  Message?: React.ComponentType<unknown>; // TODO - add generic when Message pr merged
  /** Whether to allow multiple attachment uploads */
  multipleUploads?: boolean;
  /**
   * Handle for click on @mention in message
   *
   * @param {Event} event DOM Click event
   * @param {User} user   Target [user object](https://getstream.io/chat/docs/#chat-doc-set-user) which is clicked
   */
  onMentionsClick?: OnMentionAction<Us>;
  /**
   * Handle for hover on @mention in message
   *
   * @param {Event} event DOM hover event
   * @param {User} user   Target [user object](https://getstream.io/chat/docs/#chat-doc-set-user) which is hovered
   */
  onMentionsHover?: OnMentionAction<Us>;
};

const UnMemoizedChannel = <
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends UnknownType = DefaultUserType
>(
  props: PropsWithChildren<ChannelProps<At, Ch, Co, Ev, Me, Re, Us>>,
) => {
  const { EmptyPlaceholder = null } = props;

  const { channel: contextChannel } = useChatContext<
    At,
    Ch,
    Co,
    Ev,
    Me,
    Re,
    Us
  >();

  const channel = props.channel || contextChannel;

  if (!channel?.cid) return EmptyPlaceholder;

  return <ChannelInner {...props} channel={channel} key={channel.cid} />;
};

const ChannelInner = <
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends UnknownType = DefaultUserType
>(
  props: PropsWithChildren<ChannelProps<At, Ch, Co, Ev, Me, Re, Us>> & {
    key: string;
  },
) => {
  const {
    acceptedFiles,
    Attachment = DefaultAttachment,
    channel,
    children,
    doMarkReadRequest,
    doSendMessageRequest,
    doUpdateMessageRequest,
    Emoji = DefaultEmoji,
    emojiData = defaultEmojiData,
    EmojiIndex = DefaultEmojiIndex,
    EmojiPicker = DefaultEmojiPicker,
    LoadingErrorIndicator = DefaultLoadingErrorIndicator,
    LoadingIndicator = DefaultLoadingIndicator,
    maxNumberOfFiles,
    Message = MessageSimple,
    multipleUploads = true,
    onMentionsClick,
    onMentionsHover,
  } = props;

  const { client, mutes, theme } = useChatContext<At, Ch, Co, Ev, Me, Re, Us>();
  const { t } = useTranslationContext();

  const [state, dispatch] = useReducer<
    ChannelStateReducer<At, Ch, Co, Ev, Me, Re, Us>
  >(channelReducer, initialState);

  const isMounted = useIsMounted();

  const originalTitle = useRef('');
  const lastRead = useRef(new Date());
  const online = useRef(true);

  const emojiConfig = {
    commonEmoji,
    defaultMinimalEmojis,
    Emoji,
    emojiData,
    EmojiIndex,
    EmojiPicker,
    emojiSetDef,
  };

  const throttledCopyStateFromChannel = useCallback(
    throttle(
      () => {
        if (!channel) return;
        dispatch({ channel, type: 'copyStateFromChannelOnEvent' });
      },
      500,
      { leading: true, trailing: true },
    ),
    [channel],
  );

  const markRead = useCallback(() => {
    if (!channel || channel.disconnected || !channel.getConfig()?.read_events) {
      return;
    }

    lastRead.current = new Date();

    if (doMarkReadRequest) {
      doMarkReadRequest(channel);
    } else {
      logChatPromiseExecution(channel.markRead(), 'mark read');
    }

    if (originalTitle.current) {
      document.title = originalTitle.current;
    }
  }, [channel, doMarkReadRequest]);

  const markReadThrottled = useCallback(
    throttle(markRead, 500, { leading: true, trailing: true }),
    [markRead],
  );

  const handleEvent = useCallback(
    (e) => {
      if (!channel) return;

      dispatch({ channel, message: e.message, type: 'updateThreadOnEvent' });

      if (e.type === 'connection.changed') {
        online.current = e.online;
      }

      if (e.type === 'message.new') {
        let mainChannelUpdated = true;

        if (e.message.parent_id && !e.message.show_in_channel) {
          mainChannelUpdated = false;
        }

        if (mainChannelUpdated && e.message.user.id !== client.userID) {
          if (!document.hidden) {
            markReadThrottled();
          } else if (
            channel.getConfig()?.read_events &&
            !channel.muteStatus().muted
          ) {
            const unread = channel.countUnread(lastRead.current);
            document.title = `(${unread}) ${originalTitle.current}`;
          }
        }
      }

      throttledCopyStateFromChannel();
    },
    [channel, client.userID, markReadThrottled, throttledCopyStateFromChannel],
  );

  // useLayoutEffect here to prevent spinner. Use Suspense when it is available in stable release
  useLayoutEffect(() => {
    let errored = false;
    let done = false;

    const onVisibilityChange = () => {
      if (!document.hidden) {
        markRead();
      }
    };

    (async () => {
      if (channel && !channel.initialized) {
        try {
          await channel.watch();
        } catch (e) {
          dispatch({ error: e, type: 'setError' });
          errored = true;
        }
      }

      done = true;
      originalTitle.current = document.title;

      if (channel && !errored) {
        dispatch({ channel, type: 'initStateFromChannel' });
        if (channel.countUnread() > 0) markRead();
        // The more complex sync logic is done in Chat
        document.addEventListener('visibilitychange', onVisibilityChange);
        client.on('connection.changed', handleEvent);
        client.on('connection.recovered', handleEvent);
        channel.on(handleEvent);
      }
    })();

    return () => {
      if (errored || !done) return;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      channel?.off(handleEvent);
      client.off('connection.changed', handleEvent);
      client.off('connection.recovered', handleEvent);
    };
  }, [channel, client, handleEvent, markRead]);

  useEffect(() => {
    if (state.thread && state.messages?.length) {
      for (let i = state.messages.length - 1; i >= 0; i -= 1) {
        if (state.messages[i].id === state.thread.id) {
          dispatch({ message: state.messages[i], type: 'setThread' });
          break;
        }
      }
    }
  }, [state.messages, state.thread]);

  /** MESSAGE */

  const loadMoreFinished = useCallback(
    debounce(
      /**
       * @param {boolean} hasMore
       * @param {import('stream-chat').ChannelState['messages']} messages
       */
      (hasMore, messages) => {
        if (!isMounted.current) return;
        dispatch({ hasMore, messages, type: 'loadMoreFinished' });
      },
      2000,
      {
        leading: true,
        trailing: true,
      },
    ),
    [],
  );

  const loadMore = useCallback(
    async (limit = 100) => {
      if (!online.current || !window.navigator.onLine || !channel) return 0;

      // prevent duplicate loading events...
      const oldestMessage = state?.messages?.[0];

      if (state.loadingMore || oldestMessage?.status !== 'received') return 0;

      dispatch({ loadingMore: true, type: 'setLoadingMore' });

      const oldestID = oldestMessage?.id;
      const perPage = limit;
      let queryResponse;

      try {
        queryResponse = await channel.query({
          messages: { id_lt: oldestID, limit: perPage },
        });
      } catch (e) {
        console.warn('message pagination request failed with error', e);
        dispatch({ loadingMore: false, type: 'setLoadingMore' });
        return 0;
      }

      const hasMoreMessages = queryResponse.messages.length === perPage;
      loadMoreFinished(hasMoreMessages, channel.state.messages);

      return queryResponse.messages.length;
    },
    [channel, loadMoreFinished, online, state.loadingMore, state.messages],
  );

  const updateMessage = useCallback(
    (updatedMessage) => {
      if (!channel) return;
      // adds the message to the local channel state..
      // this adds to both the main channel state as well as any reply threads
      channel.state.addMessageSorted(updatedMessage, true);

      dispatch({
        channel,
        parentId: state.thread && updatedMessage.parent_id,
        type: 'copyMessagesFromChannel',
      });
    },
    [channel, state.thread],
  );

  const doSendMessage = useCallback(
    async (message) => {
      if (!channel) return;
      const { attachments, id, mentioned_users, parent_id, text } = message;

      const messageData = {
        attachments,
        id,
        mentioned_users,
        parent_id,
        text,
      } as Message<At, Me, Us>;

      try {
        let messageResponse;

        if (doSendMessageRequest) {
          messageResponse = await doSendMessageRequest(
            channel.cid,
            messageData,
          );
        } else {
          messageResponse = await channel.sendMessage(messageData);
        }

        // replace it after send is completed
        if (messageResponse && messageResponse.message) {
          updateMessage({
            ...messageResponse.message,
            status: 'received',
          });
        }
      } catch (e) {
        // set the message to failed..
        updateMessage({
          ...message,
          status: 'failed',
        });
      }
    },
    [channel, doSendMessageRequest, updateMessage],
  );

  const createMessagePreview = useCallback(
    (text, attachments, parent, mentioned_users) => {
      // create a preview of the message
      const clientSideID = `${client.userID}-${uuidv4()}`;
      return {
        __html: text,
        attachments,
        created_at: new Date(),
        html: text,
        id: clientSideID,
        mentioned_users,
        reactions: [],
        status: 'sending',
        text,
        type: 'regular',
        user: client.user,
        ...(parent?.id ? { parent_id: parent.id } : null),
      };
    },
    [client.user, client.userID],
  );

  const sendMessage = useCallback(
    async ({ text, attachments = [], mentioned_users = [], parent }) => {
      if (!channel) return;

      // remove error messages upon submit
      channel.state.filterErrorMessages();

      // create a local preview message to show in the UI
      const messagePreview = createMessagePreview(
        text,
        attachments,
        parent,
        mentioned_users,
      );

      // first we add the message to the UI
      updateMessage(messagePreview);

      await doSendMessage(messagePreview);
    },
    [channel?.state, createMessagePreview, doSendMessage, updateMessage],
  );

  const retrySendMessage = useCallback(
    async (message) => {
      // set the message status to sending
      updateMessage({
        ...message,
        status: 'sending',
      });

      // actually try to send the message...
      await doSendMessage(message);
    },
    [doSendMessage, updateMessage],
  );

  const removeMessage = useCallback(
    (message) => {
      if (!channel) return;

      channel.state.removeMessage(message);

      dispatch({
        channel,
        parentId: state.thread && message.parent_id,
        type: 'copyMessagesFromChannel',
      });
    },
    [channel, state.thread],
  );

  /** THREAD */

  const openThread = useCallback(
    (message, e) => {
      if (!channel) return;

      if (e && e.preventDefault) {
        e.preventDefault();
      }

      dispatch({ channel, message, type: 'openThread' });
    },
    [channel],
  );

  const loadMoreThreadFinished = useCallback(
    debounce(
      /**
       * @param {boolean} threadHasMore
       * @param {Array<ReturnType<import('stream-chat').ChannelState['formatMessage']>>} threadMessages
       */
      (threadHasMore, threadMessages) => {
        dispatch({
          threadHasMore,
          threadMessages,
          type: 'loadMoreThreadFinished',
        });
      },
      2000,
      { leading: true, trailing: true },
    ),
    [],
  );

  const loadMoreThread = useCallback(async () => {
    // prevent duplicate loading events...
    if (!channel || state.threadLoadingMore || !state.thread) return;

    dispatch({ type: 'startLoadingThread' });
    const parentID = state.thread.id;

    if (!parentID) {
      dispatch({ type: 'closeThread' });
      return;
    }

    const oldMessages = channel.state.threads[parentID] || [];
    const oldestMessageID = oldMessages[0]?.id;
    const limit = 50;

    try {
      const queryResponse = await channel.getReplies(parentID, {
        id_lt: oldestMessageID,
        limit,
      });

      const threadHasMoreMessages = queryResponse.messages.length === limit;
      const newThreadMessages = channel.state.threads[parentID] || [];

      // next set loadingMore to false so we can start asking for more data...
      loadMoreThreadFinished(threadHasMoreMessages, newThreadMessages);
    } catch (e) {
      loadMoreThreadFinished(false, oldMessages);
    }
  }, [channel, loadMoreThreadFinished, state.thread, state.threadLoadingMore]);

  const closeThread = useCallback((e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    dispatch({ type: 'closeThread' });
  }, []);

  const onMentionsHoverOrClick = useMentionsHandlers(
    onMentionsHover,
    onMentionsClick,
  );

  const editMessage = useEditMessageHandler(doUpdateMessageRequest);

  const channelContextValue: ChannelContextValue<At, Ch, Co, Ev, Me, Re, Us> = {
    ...state,
    acceptedFiles,
    // @ts-expect-error
    Attachment, // TODO - type Attachment and ensure this matches ChannelContextValue['Attachment']
    channel,
    client, // from chatContext, for legacy reasons
    closeThread,
    dispatch,
    editMessage,
    emojiConfig, // emoji config and customization object, potentially find a better home
    loadMore,
    loadMoreThread,
    maxNumberOfFiles,
    // @ts-expect-error
    Message, // TODO - type Message and ensure this matches ChannelContextValue['Message']
    multipleUploads,
    mutes,
    onMentionsClick: onMentionsHoverOrClick,
    onMentionsHover: onMentionsHoverOrClick,
    openThread,
    removeMessage,
    retrySendMessage,
    sendMessage,
    updateMessage,
    watcher_count: state.watcherCount,
  };

  if (state.error) {
    return (
      <div className={`str-chat str-chat-channel ${theme}`}>
        <LoadingErrorIndicator error={state.error} />
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className={`str-chat str-chat-channel ${theme}`}>
        <LoadingIndicator size={25} />
      </div>
    );
  }

  if (!channel?.watch) {
    return (
      <div className={`str-chat str-chat-channel ${theme}`}>
        <div>{t('Channel Missing')}</div>
      </div>
    );
  }

  return (
    <div className={`str-chat str-chat-channel ${theme}`}>
      <ChannelProvider<At, Ch, Co, Ev, Me, Re, Us> value={channelContextValue}>
        <div className='str-chat__container'>{children}</div>
      </ChannelProvider>
    </div>
  );
};

export const Channel = React.memo(
  UnMemoizedChannel,
) as typeof UnMemoizedChannel;