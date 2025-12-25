import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ua';

interface Translations {
    // Navigation
    feed: string;
    explore: string;
    chat: string;
    bookmarks: string;
    savedMessages: string;
    bookmark: string;
    settings: string;
    profile: string;
    post: string;
    
    // Settings
    notifications: string;
    pushNotifications: string;
    pushNotificationsDesc: string;
    emailNotifications: string;
    emailNotificationsDesc: string;
    privacy: string;
    privateProfile: string;
    privateProfileDesc: string;
    interface: string;
    language: string;
    tipping: string;
    defaultTipAmount: string;
    defaultTipDesc: string;
    explorerSettings: string;
    preferredExplorer: string;
    preferredExplorerDesc: string;
    enableNotifications: string;
    notificationsDesc: string;
    notifyTips: string;
    notifyTipsDesc: string;
    notifyErrors: string;
    notifyErrorsDesc: string;
    whoCanMessage: string;
    whoCanMessageDesc: string;
    everyone: string;
    followersOnly: string;
    movementScan: string;
    aptosScan: string;
    soundEffects: string;
    soundDesc: string;
    general: string;
    save: string;
    saving: string;
    settingsSaved: string;
    settingsSavedLocally: string;
    settingsSaveError: string;
    
    // Common
    loading: string;
    processing: string;
    error: string;
    follow: string;
    unfollow: string;
    followers: string;
    following: string;
    followingBtn: string;
    posts: string;
    replies: string;
    likes: string;
    createPost: string;
    search: string;
    whatsHappening: string;
    trending: string;
    whoToFollow: string;
    showMore: string;
    moreOptions: string;
    edit: string;
    delete: string;
    cancel: string;
    blockConfirm: string;
    share: string;
    tip: string;

    // Notifications Page
    notificationsTitle: string;
    all: string;
    mentions: string;
    comments: string;
    follows: string;
    reposts: string;
    noActivity: string;
    markAllRead: string;
    
    // Notifications Component
    clearAll: string;
    noNotifications: string;
    
    // Create Post
    createPostTitle: string;
    leaveComment: string;
    writeReply: string;
    quoteRepost: string;
    whatsHappeningPlaceholder: string;
    whatsOnYourMind: string;
    mediaLimitError: string;
    imageTooLargeError: string;
    postCreatedSuccess: string;
    postCreationError: string;
    errorCreatingPost: string;
    postButton: string;
    replyButton: string;
    photo: string;
    video: string;
    posting: string;
    repostButton: string;
    videoTooLarge: string;
    pleaseConnectWallet: string;
    enterContentOrMedia: string;
    contentTooLong: string;
    reposting: string;
    contentEmpty: string;
    // Right Sidebar
    networkStats: string;
    totalVolume: string;
    totalTips: string;
    topTipper: string;
    noSuggestions: string;
    postsCount: string;
    noTrending: string;
    terms: string;
    docs: string;
    builtOnMovement: string;
    
    // imageTooLarge5MB: string;  <-- REMOVED DUPLICATE

    // Profile Edit
    bio: string;
    avatarUrl: string;
    website: string;
    location: string;
    createProfile: string;
    usernameRequired: string;
    profileCreated: string;
    displayName: string;
    bioPlaceholder: string;
    locationPlaceholder: string;
    websitePlaceholder: string;
    bannerPlaceholder: string;
    saveProfile: string;
    editProfile: string;
    moveReceived: string;
    moveSent: string;
    tipsReceived: string;
    tipsSent: string;
    noPostsTitle: string;
    noPostsDesc: string;
    noFeedTitle: string;
    noFeedDesc: string;
    copyAddress: string;
    profileUpdated: string;
    profileUpdateError: string;
    profileCreated: string;
    usernameRequired: string;
    usernameTaken: string;
    imageTooLarge: string;
    imageTooLarge5MB: string;

    // TipHistory
    activity: string;
    clearActivity: string;
    clearActivityConfirm: string;
    sent: string;
    received: string;
    noTips: string;
    startTipping: string;
    shareProfile: string;
    recipient: string;
    sender: string;
    amount: string;
    time: string;
    status: string;
    sentTo: string;
    receivedFrom: string;

    // PostCard & Comments
    cannotTipOwn: string;
    tipSuccess: string;
    tipError: string;
    commentsTitle: string;
    postReplyPlaceholder: string;
    connectToReply: string;
    noComments: string;
    repostSuccess: string;
    repostError: string;
    copyLink: string;
    linkCopied: string;
    postUpdated: string;
    postUpdateError: string;
    deleteConfirm: string;
    postDeleted: string;
    postDeleteError: string;
    
    // Post Actions
    notInterested: string;
    mute: string;
    block: string;
    unmute: string;
    unblock: string;
    report: string;
    
    // Actions
    connectWallet: string;
    voteError: string;
    processingImage: string;
    compressionError: string;
    changeImage: string;
    addImage: string;
    remove: string;
    unfollowed: string;
    undoSuccess: string;
    undo: string;
    postHidden: string;
    success: string;

    // Search
    searchPlaceholder: string;
    people: string;
    noResults: string;

    // Landing
    features: string;
    about: string;
    poweredBy: string;
    landingTitle: string;
    landingSubtitle: string;
    landingDesc: string;
    fast: string;
    instantTips: string;
    secure: string;
    onChain: string;
    simple: string;
    easyToUse: string;

    // Landing - Features & About
    featuresTitle: string;
    featuresDesc: string;
    sharePosts: string;
    sharePostsDesc: string;
    onChainTips: string;
    onChainTipsDesc: string;
    movementNetwork: string;
    movementNetworkDesc: string;
    aboutTitle: string;
    aboutDesc1: string;
    aboutDesc2: string;
    movementDocs: string;
    explorer: string;

    // Single Post
    postNotFound: string;
    returnToFeed: string;
    viewAllComments: string;

    // Challenges
    acceptChallenge: string;
    inProgress: string;
    claimReward: string;
    completed: string;
}

const translations: Record<Language, Translations> = {
    en: {
        feed: 'Feed',
        explore: 'Explore',
        chat: 'Chat',
        bookmarks: 'Bookmarks',
        savedMessages: 'Saved Messages',
        bookmark: 'Bookmark',
        settings: 'Settings',
        profile: 'Profile',
        post: 'Post',
        
        notifications: 'Notifications',
        pushNotifications: 'Push Notifications',
        pushNotificationsDesc: 'Receive notifications in real-time',
        emailNotifications: 'Email Notifications',
        emailNotificationsDesc: 'Receive weekly digest',
        privacy: 'Privacy',
        privateProfile: 'Private Profile',
        privateProfileDesc: 'Only followers can see your posts',
        interface: 'Interface',
        language: 'Language',
        tipping: 'Tipping',
        defaultTipAmount: 'Default Tip Amount (MOVE)',
        defaultTipDesc: 'Set your preferred tip amount for quick tipping',
        explorerSettings: 'Explorer',
        preferredExplorer: 'Preferred Explorer',
        preferredExplorerDesc: 'Choose which explorer to use for links',
        enableNotifications: 'Enable Notifications',
        notificationsDesc: 'Receive alerts about tips and updates',
        notifyTips: 'Incoming Tips',
        notifyTipsDesc: 'Get notified when you receive MOVE',
        notifyErrors: 'Transaction Errors',
        notifyErrorsDesc: 'Get notified when a transaction fails',
        whoCanMessage: 'Who can message you?',
        whoCanMessageDesc: 'Control who can start a direct conversation with you.',
        everyone: 'Everyone',
        followersOnly: 'Followers Only',
        movementScan: 'Movement Scan (Official)',
        aptosScan: 'Aptos Scan',
        soundEffects: 'Sound Effects',
        soundDesc: 'Play sounds for interactions',
        general: 'General',
        save: 'Save Changes',
        saving: 'Saving...',
        settingsSaved: 'Settings saved successfully!',
        settingsSavedLocally: 'Settings saved locally (Supabase not connected)',
        settingsSaveError: 'Failed to save settings',
        
        loading: 'Loading...',
        processing: 'Processing...',
        error: 'Error',
        follow: 'Follow',
        unfollow: 'Unfollow',
        followers: 'Followers',
        following: 'Following',
        followingBtn: 'Following',
        posts: 'Posts',
        replies: 'Replies',
        likes: 'Likes',
        createPost: 'Create Post',
        search: 'Search',
        whatsHappening: "What's happening?",
        trending: 'Trending',
        whoToFollow: 'Who to follow',
        showMore: 'Show more',
        moreOptions: 'More options',
        edit: 'Edit',
        delete: 'Delete',
        cancel: 'Cancel',
        blockConfirm: 'Are you sure you want to block this user?',
        share: 'Share',
        tip: 'Tip',

        // Notifications Page
        notificationsTitle: 'Notifications',
        all: 'All',
        mentions: 'Mentions',
        comments: 'Comments',
        follows: 'New followers',
        reposts: 'Reposts/Quotes',
        noActivity: 'No notifications yet',
        markAllRead: 'Mark all as read',

        // Notifications Component
        clearAll: 'Clear all',
        noNotifications: 'No notifications yet',

        createPostTitle: 'Create a Post',
        leaveComment: 'Leave a Comment',
        writeReply: 'Tweet your reply',
        quoteRepost: 'Quote Repost',
        whatsHappeningPlaceholder: 'What is happening?!',
        whatsOnYourMind: 'What is happening?!',
        mediaLimitError: 'Maximum 4 media items allowed',
        imageTooLargeError: 'Image too large (max 10MB before compression)',
        postCreatedSuccess: 'Post created successfully!',
        postCreationError: 'Failed to create post. Please try again.',
        errorCreatingPost: 'Failed to create post',
        postButton: 'Post',
        replyButton: 'Reply',
        photo: 'Photo',
        video: 'Video',
        posting: 'Posting...',
        repostButton: 'Repost',
        videoTooLarge: 'Video too large (max 5MB allowed for now)',
        pleaseConnectWallet: 'Please connect your wallet first',
        enterContentOrMedia: 'Please enter some content or add media',
        contentTooLong: 'Content must be 1000 characters or less',
        reposting: 'Reposting',
        contentEmpty: 'Content cannot be empty',

        networkStats: 'Network Stats',
        totalVolume: 'Total Volume',
        totalTips: 'Total Tips',
        topTipper: 'Top Tipper',
        noSuggestions: 'No suggestions yet.',
        postsCount: 'posts',
        noTrending: 'No trending topics yet.',
        terms: 'Terms',
        docs: 'Docs',
        builtOnMovement: 'Built on Movement',
        
        imageTooLarge5MB: 'Image too large (max 5MB)',
        
        editProfile: 'Edit Profile',
        saveProfile: 'Save Profile',
        createProfile: 'Create Profile',
        displayName: 'Display Name',
        bio: 'Bio',
        avatarUrl: 'Avatar URL',
        website: 'Website',
        location: 'Location',
        displayNamePlaceholder: 'Display Name',
        bioPlaceholder: 'Bio',
        locationPlaceholder: 'Location',
        websitePlaceholder: 'Website',
        bannerPlaceholder: 'Paste banner image URL',
        moveReceived: 'MOVE Received',
        moveSent: 'MOVE Sent',
        tipsReceived: 'Tips Received',
        tipsSent: 'Tips Sent',
        noPostsTitle: 'No Posts Yet',
        noPostsDesc: "This user hasn't posted anything yet.",
        noFeedTitle: 'No Posts Yet',
        noFeedDesc: 'Be the first to post something!',
        copyAddress: 'Copy Address',
        profileUpdated: 'Profile updated successfully!',
        profileUpdateError: 'Failed to update profile. Please try again.',
        profileCreated: 'Profile created successfully!',
        usernameRequired: 'Username is required',
        usernameTaken: 'Username is already taken',
        imageTooLarge: 'Image too large for on-chain storage. Please try a smaller image.',
        imageTooLarge5MB: 'Image too large (max 5MB)',

        activity: 'Activity',
        clearActivity: 'Clear Activity',
        clearActivityConfirm: 'Clear your entire activity history? This will hide received tips and delete local sent history.',
        sent: 'Sent',
        received: 'Received',
        noTips: 'No tips yet',
        startTipping: 'Start tipping creators!',
        shareProfile: 'Share your profile to get tips!',
        recipient: 'Recipient',
        sender: 'Sender',
        amount: 'Amount',
        time: 'Time',
        status: 'Status',
        sentTo: 'Sent to',
        receivedFrom: 'Received from',

        cannotTipOwn: 'You cannot tip your own content',
        tipSuccess: 'Tip sent successfully!',
        tipError: 'Failed to send tip',
        commentsTitle: 'Comments',
        postReplyPlaceholder: 'Post your reply',
        connectToReply: 'Connect wallet to reply.',
        noComments: 'No comments yet. Be the first to reply!',
        repostSuccess: 'Reposted successfully!',
        repostError: 'Failed to repost',
        copyLink: 'Copy link',
        linkCopied: 'Link copied!',

        postUpdated: 'Post updated successfully!',
        postUpdateError: 'Failed to update post.',
        deleteConfirm: 'Are you sure you want to delete this post?',
        postDeleted: 'Post deleted successfully!',
        postDeleteError: 'Failed to delete post.',

        connectWallet: 'Please connect your wallet',
        voteError: 'Failed to vote',
        processingImage: 'Processing image...',
        compressionError: 'Image too complex to compress',
        changeImage: 'Change Image',
        addImage: 'Add Image',
        remove: 'Remove',
        unfollowed: 'Unfollowed successfully',
        undoSuccess: 'Undone',
        undo: 'Undo',
        postHidden: "Post hidden. Use 'Mute' to hide posts from this user.",
        success: 'Success',

        searchPlaceholder: 'Search MoveX',
        people: 'People',
        noResults: 'No results found for',

        features: 'Features',
        about: 'About',
        poweredBy: 'Powered by Movement Network',
        landingTitle: 'Post your thoughts.',
        landingSubtitle: 'Get on-chain tips.',
        landingDesc: 'A micro-social platform where creators share short posts and supporters send on-chain tips directly on Movement Network.',
        fast: 'Fast',
        instantTips: 'Instant tips',
        secure: 'Secure',
        onChain: 'On-chain',
        simple: 'Simple',
        easyToUse: 'Easy to use',

        featuresTitle: 'Features',
        featuresDesc: 'Everything you need to share your thoughts and earn on-chain tips',
        sharePosts: 'Share Posts',
        sharePostsDesc: 'Publish short, impactful posts and build your audience',
        onChainTips: 'On-Chain Tips',
        onChainTipsDesc: 'Receive tips directly to your wallet, secured on Movement Network',
        movementNetwork: 'Movement Network',
        movementNetworkDesc: "Built on Movement's fast and secure blockchain infrastructure",
        aboutTitle: 'About MoveX',
        aboutDesc1: 'MoveX is a new kind of social platform that puts creators first. Share your thoughts, build your audience, and earn on-chain tips from supporters who value your content.',
        aboutDesc2: 'Built on Movement Network, every tip is secured on-chain, giving you full control and transparency over your earnings. No intermediaries, no hidden fees—just direct support from your community.',
        movementDocs: 'Movement Docs',
        explorer: 'Explorer',
// Single Post
        postNotFound: 'Post not found.',
        returnToFeed: 'Return to Feed',
        viewAllComments: 'View all comments',

        // Post Actions
        notInterested: "Not interested in this",
        mute: "Mute",
        block: "Block",
        unmute: "Unmute",
        unblock: "Unblock",
        report: "Report",

        acceptChallenge: 'Accept Challenge',
        inProgress: 'In Progress',
        claimReward: 'Claim Reward',
        completed: 'Completed'
    },
    ua: {
        feed: 'Стрічка',
        explore: 'Огляд',
        chat: 'Повідомлення',
        bookmarks: 'Закладки',
        savedMessages: 'Збережене',
        bookmark: 'Закладка',
        settings: 'Налаштування',
        profile: 'Профіль',
        post: 'Опублікувати',
        
        notifications: 'Сповіщення',
        pushNotifications: 'Push-сповіщення',
        pushNotificationsDesc: 'Отримувати сповіщення в реальному часі',
        emailNotifications: 'Email-сповіщення',
        emailNotificationsDesc: 'Отримувати щотижневий дайджест',
        privacy: 'Конфіденційність',
        privateProfile: 'Приватний профіль',
        privateProfileDesc: 'Тільки підписники можуть бачити ваші пости',
        interface: 'Інтерфейс',
        language: 'Мова',
        tipping: 'Чайові',
        defaultTipAmount: 'Сума чайових за замовчуванням (MOVE)',
        defaultTipDesc: 'Встановіть бажану суму чайових для швидкого відправлення',
        explorerSettings: 'Експлорер',
        preferredExplorer: 'Бажаний експлорер',
        preferredExplorerDesc: 'Виберіть, який експлорер використовувати для посилань',
        enableNotifications: 'Увімкнути сповіщення',
        notificationsDesc: 'Отримувати сповіщення про чайові та оновлення',
        notifyTips: 'Вхідні транзакції (Tips)',
        notifyTipsDesc: 'Сповіщення про отримання MOVE',
        notifyErrors: 'Помилки транзакцій',
        notifyErrorsDesc: 'Сповіщення про невдалі транзакції',
        whoCanMessage: 'Хто може писати вам?',
        whoCanMessageDesc: 'Керуйте тим, хто може почати з вами пряму розмову.',
        everyone: 'Усі',
        followersOnly: 'Тільки підписники',
        movementScan: 'Movement Scan (Офіційний)',
        aptosScan: 'Aptos Scan',
        soundEffects: 'Звукові ефекти',
        soundDesc: 'Відтворювати звуки при взаємодії',
        general: 'Загальні',
        save: 'Зберегти зміни',
        saving: 'Збереження...',
        settingsSaved: 'Налаштування збережено успішно!',
        settingsSavedLocally: 'Налаштування збережено локально (Supabase не підключено)',
        settingsSaveError: 'Не вдалося зберегти налаштування',
        
        loading: 'Завантаження...',
        processing: 'Обробка...',
        error: 'Помилка',
        follow: 'Стежити',
        unfollow: 'Не стежити',
        followers: 'Підписники',
        following: 'Підписки',
        followingBtn: 'Стежу',
        posts: 'Пости',
        replies: 'Відповіді',
        likes: 'Вподобання',
        createPost: 'Створити пост',
        search: 'Пошук',
        whatsHappening: 'Що відбувається?',
        trending: 'Актуальне',
        whoToFollow: 'Кого читати',
        showMore: 'Показати більше',
        moreOptions: 'Більше опцій',
        edit: 'Редагувати',
        delete: 'Видалити',
        cancel: 'Скасувати',
        blockConfirm: 'Ви впевнені, що хочете заблокувати цього користувача?',
        share: 'Поділитися',
        tip: 'Підтримати',

        // Notifications Page
        notificationsTitle: 'Сповіщення',
        all: 'Всі',
        mentions: 'Згадування',
        comments: 'Коментарі',
        follows: 'Нові підписники',
        reposts: 'Репости/Квоти',
        noActivity: 'Сповіщень поки немає',
        markAllRead: 'Позначити всі як прочитані',

        // Notifications Component
        clearAll: 'Очистити все',
        noNotifications: 'Поки немає сповіщень',

        createPostTitle: 'Створити пост',
        leaveComment: 'Залишити коментар',
        writeReply: 'Напишіть вашу відповідь',
        quoteRepost: 'Цитувати',
        whatsHappeningPlaceholder: 'Що відбувається?!',
        whatsOnYourMind: 'Що відбувається?!',
        mediaLimitError: 'Максимум 4 медіа файли',
        imageTooLargeError: 'Зображення занадто велике (макс 10MB)',
        postCreatedSuccess: 'Пост створено успішно!',
        postCreationError: 'Не вдалося створити пост. Спробуйте ще раз.',
        errorCreatingPost: 'Не вдалося створити пост',
        postButton: 'Опублікувати',
        replyButton: 'Відповісти',
        photo: 'Фото',
        video: 'Відео',
        posting: 'Публікація...',
        repostButton: 'Репост',
        videoTooLarge: 'Відео занадто велике (макс 5MB дозволено)',
        pleaseConnectWallet: 'Будь ласка, спочатку підключіть гаманець',
        enterContentOrMedia: 'Введіть текст або додайте медіа',
        contentTooLong: 'Текст має бути менше 1000 символів',
        reposting: 'Репост',
        contentEmpty: 'Вміст не може бути порожнім',

        networkStats: 'Статистика мережі',
        totalVolume: 'Загальний обсяг',
        totalTips: 'Всього чайових',
        topTipper: 'Топ меценат',
        noSuggestions: 'Поки немає пропозицій.',
        postsCount: 'постів',
        noTrending: 'Поки немає актуальних тем.',
        terms: 'Умови',
        docs: 'Документація',
        builtOnMovement: 'Побудовано на Movement',

        imageTooLarge5MB: 'Зображення занадто велике (макс 5MB)',
        
        editProfile: 'Редагувати профіль',
        saveProfile: 'Зберегти профіль',
        createProfile: 'Створити профіль',
        displayName: "Відображуване ім'я",
        bio: 'Про себе',
        avatarUrl: 'URL аватара',
        website: 'Веб-сайт',
        location: 'Місцезнаходження',
        displayNamePlaceholder: "Відображуване ім'я",
        bioPlaceholder: 'Про себе',
        locationPlaceholder: 'Місцезнаходження',
        websitePlaceholder: 'Веб-сайт',
        bannerPlaceholder: 'Вставте посилання на банер',
        moveReceived: 'MOVE отримано',
        moveSent: 'MOVE надіслано',
        tipsReceived: 'Отримані чайові',
        tipsSent: 'Надіслані чайові',
        noPostsTitle: 'Поки немає постів',
        noPostsDesc: 'Цей користувач ще нічого не опублікував.',
        noFeedTitle: 'Поки немає постів',
        noFeedDesc: 'Будьте першим, хто щось опублікує!',
        copyAddress: 'Копіювати адресу',
        profileUpdated: 'Профіль оновлено!',
        profileUpdateError: 'Не вдалося оновити профіль. Спробуйте ще раз.',
        profileCreated: 'Профіль створено успішно!',
        usernameRequired: "Ім'я користувача обов'язкове",
        usernameTaken: "Це ім'я користувача вже зайняте",
        imageTooLarge: 'Зображення занадто велике для зберігання в блокчейні. Спробуйте менше.',
        imageTooLarge5MB: 'Зображення занадто велике (макс 5MB)',

        activity: 'Активність',
        clearActivity: 'Очистити активність',
        clearActivityConfirm: 'Очистити всю історію активності? Це приховає отримані чайові та видалить локальну історію надісланих.',
        sent: 'Надіслані',
        received: 'Отримані',
        noTips: 'Поки немає чайових',
        startTipping: 'Почніть підтримувати авторів!',
        shareProfile: 'Поділіться профілем, щоб отримувати чайові!',
        recipient: 'Отримувач',
        sender: 'Відправник',
        amount: 'Сума',
        time: 'Час',
        status: 'Статус',
        sentTo: 'Надіслано',
        receivedFrom: 'Отримано від',

        cannotTipOwn: 'Ви не можете надсилати чайові собі',
        tipSuccess: 'Чайові надіслано успішно!',
        tipError: 'Не вдалося надіслати чайові',
        commentsTitle: 'Коментарі',
        postReplyPlaceholder: 'Напишіть вашу відповідь',
        connectToReply: 'Підключіть гаманець, щоб відповісти.',
        noComments: 'Поки немає коментарів. Будьте першим!',
        repostSuccess: 'Репост успішний!',
        repostError: 'Не вдалося зробити репост',
        copyLink: 'Копіювати посилання',
        linkCopied: 'Посилання скопійовано!',

        postUpdated: 'Пост успішно оновлено!',
        postUpdateError: 'Не вдалося оновити пост.',
        deleteConfirm: 'Ви впевнені, що хочете видалити цей пост?',
        postDeleted: 'Пост успішно видалено!',
        postDeleteError: 'Не вдалося видалити пост.',

        connectWallet: 'Будь ласка, підключіть гаманець',
        voteError: 'Не вдалося проголосувати',
        processingImage: 'Обробка зображення...',
        compressionError: 'Зображення занадто складне для стиснення',
        changeImage: 'Змінити зображення',
        addImage: 'Додати зображення',
        remove: 'Видалити',

        searchPlaceholder: 'Пошук MoveX',
        people: 'Люди',
        noResults: 'Нічого не знайдено за запитом',

        features: 'Можливості',
        about: 'Про нас',
        poweredBy: 'Побудовано на Movement Network',
        landingTitle: 'Публікуйте думки.',
        landingSubtitle: 'Отримуйте чайові.',
        landingDesc: 'Мікро-соціальна платформа, де автори діляться короткими постами, а прихильники надсилають чайові прямо в мережі Movement.',
        fast: 'Швидко',
        instantTips: 'Миттєві чайові',
        secure: 'Безпечно',
        onChain: 'Ончейн',
        simple: 'Просто',
        easyToUse: 'Зручно у використанні',

        featuresTitle: 'Можливості',
        featuresDesc: 'Все необхідне для публікації думок та отримання чайових',
        sharePosts: 'Діліться постами',
        sharePostsDesc: 'Публікуйте короткі, влучні пости та будуйте свою аудиторію',
        onChainTips: 'Ончейн чайові',
        onChainTipsDesc: 'Отримуйте чайові прямо на гаманець, захищені мережею Movement',
        movementNetwork: 'Мережа Movement',
        movementNetworkDesc: 'Побудовано на швидкій та безпечній інфраструктурі блокчейну Movement',
        aboutTitle: 'Про MoveX',
        aboutDesc1: 'MoveFeed — це новий вид соціальної платформи, де автори на першому місці. Діліться думками, будуйте аудиторію та отримуйте чайові від прихильників, які цінують ваш контент.',
        aboutDesc2: 'Завдяки мережі Movement, кожен переказ захищений ончейн, що дає вам повний контроль та прозорість доходів. Жодних посередників, жодних прихованих комісій — лише пряма підтримка від вашої спільноти.',
        movementDocs: 'Документація Movement',
        explorer: 'Оглядач',

        postNotFound: 'Пост не знайдено.',
        returnToFeed: 'Повернутися до стрічки',
        viewAllComments: 'Переглянути всі коментарі',

        acceptChallenge: 'Прийняти виклик',
        inProgress: 'В процесі',
        claimReward: 'Забрати нагороду',
        completed: 'Завершено',

        // Post Actions
        notInterested: "Не цікаво",
        mute: "Ігнорувати",
        block: "Заблокувати",
        unmute: "Не ігнорувати",
        unblock: "Розблокувати",
        report: "Поскаржитися",
        unfollowed: 'Відписано успішно',
        undoSuccess: 'Скасовано',
        undo: 'Скасувати',
        postHidden: "Пост приховано. Використовуйте 'Ігнорувати', щоб приховати пости цього користувача.",
        success: 'Успішно',
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    // Default to 'en'
    const [language, setLanguage] = useState<Language>('en');

    // Load saved language from localStorage on mount
    useEffect(() => {
        const savedLang = localStorage.getItem('app-language');
        if (savedLang === 'en' || savedLang === 'ua') {
            setLanguage(savedLang);
        }
    }, []);

    // Save language to localStorage when changed
    useEffect(() => {
        localStorage.setItem('app-language', language);
    }, [language]);

    const value = {
        language,
        setLanguage,
        t: translations[language]
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
