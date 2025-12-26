module mines::move_feed_v13 {
    use std::string::String;
    use std::vector;
    use std::signer;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;

    struct GlobalFeed has key {
        posts: vector<Post>,
        comments: vector<Comment>,
        post_counter: u64,
        comment_counter: u64,
        post_events: EventHandle<PostEvent>,
        comment_events: EventHandle<CommentEvent>,
    }

    struct Post has store, drop, copy {
        id: u64,
        author: address,
        content: String,
        image_url: String,
        timestamp: u64,
        is_deleted: bool,
    }

    struct Comment has store, drop, copy {
        id: u64,
        parent_id: u64,
        author: address,
        content: String,
        timestamp: u64,
    }

    struct Profile has key {
        name: String,
        bio: String,
        avatar_url: String,
    }

    struct PostEvent has drop, store {
        id: u64,
        author: address,
        content: String,
        timestamp: u64,
    }

    struct CommentEvent has drop, store {
        id: u64,
        parent_id: u64,
        author: address,
        content: String,
        timestamp: u64,
    }

    public entry fun initialize(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<GlobalFeed>(addr)) {
            move_to(account, GlobalFeed {
                posts: vector::empty(),
                comments: vector::empty(),
                post_counter: 0,
                comment_counter: 0,
                post_events: account::new_event_handle<PostEvent>(account),
                comment_events: account::new_event_handle<CommentEvent>(account),
            });
        }
    }

    public entry fun create_post(account: &signer, content: String, image_url: String) acquires GlobalFeed {
        let author = signer::address_of(account);
        let feed = borrow_global_mut<GlobalFeed>(@mines);
        let id = feed.post_counter;
        feed.post_counter = feed.post_counter + 1;
        let post = Post {
            id,
            author,
            content,
            image_url,
            timestamp: timestamp::now_seconds(),
            is_deleted: false,
        };
        vector::push_back(&mut feed.posts, post);
        event::emit_event(&mut feed.post_events, PostEvent {
            id,
            author,
            content,
            timestamp: post.timestamp,
        });
    }

    public entry fun delete_post(account: &signer, post_id: u64) acquires GlobalFeed {
        let author = signer::address_of(account);
        let feed = borrow_global_mut<GlobalFeed>(@mines);
        
        let i = 0;
        let len = vector::length(&feed.posts);
        while (i < len) {
            let post = vector::borrow_mut(&mut feed.posts, i);
            if (post.id == post_id) {
                assert!(post.author == author, 403);
                post.is_deleted = true;
                break
            };
            i = i + 1;
        };
    }

    public entry fun create_comment(account: &signer, _parent_id_str: String, parent_id: u64, content: String, _image_url: String) acquires GlobalFeed {
        let author = signer::address_of(account);
        let feed = borrow_global_mut<GlobalFeed>(@mines);
        let id = feed.comment_counter;
        feed.comment_counter = feed.comment_counter + 1;
        let comment = Comment {
            id,
            parent_id,
            author,
            content,
            timestamp: timestamp::now_seconds(),
        };
        vector::push_back(&mut feed.comments, comment);
        event::emit_event(&mut feed.comment_events, CommentEvent {
            id,
            parent_id,
            author,
            content,
            timestamp: comment.timestamp,
        });
    }

    #[view]
    public fun get_global_posts_count(): u64 acquires GlobalFeed {
        if (exists<GlobalFeed>(@mines)) {
             let feed = borrow_global<GlobalFeed>(@mines);
             let count = 0;
             let i = 0;
             let len = vector::length(&feed.posts);
             while (i < len) {
                 let post = vector::borrow(&feed.posts, i);
                 if (!post.is_deleted) {
                     count = count + 1;
                 };
                 i = i + 1;
             };
             count
        } else {
            0
        }
    }

    #[view]
    public fun get_user_posts_count(user_addr: address): u64 acquires GlobalFeed {
        if (!exists<GlobalFeed>(@mines)) {
            return 0
        };
        let feed = borrow_global<GlobalFeed>(@mines);
        let count = 0;
        let i = 0;
        let len = vector::length(&feed.posts);
        while (i < len) {
            let post = vector::borrow(&feed.posts, i);
            if (post.author == user_addr && !post.is_deleted) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    #[view]
    public fun get_user_posts_paginated(user_addr: address, page: u64, limit: u64): (vector<Post>, u64) acquires GlobalFeed {
        if (!exists<GlobalFeed>(@mines)) {
            return (vector::empty(), 0)
        };
        let feed = borrow_global<GlobalFeed>(@mines);
        let total_count = 0;
        let user_posts = vector::empty<Post>();
        
        let i = 0;
        let len = vector::length(&feed.posts);
        while (i < len) {
            let post = vector::borrow(&feed.posts, i);
            if (post.author == user_addr && !post.is_deleted) {
                vector::push_back(&mut user_posts, *post);
                total_count = total_count + 1;
            };
            i = i + 1;
        };

        let result = vector::empty<Post>();
        let start_index = page * limit;
        if (start_index >= total_count) {
            return (result, total_count)
        };
        
        let skipped = page * limit;
        let i = total_count - skipped;
        let end_threshold = 0;
        if (i > limit) {
            end_threshold = i - limit;
        };
        
        while (i > end_threshold) {
             vector::push_back(&mut result, *vector::borrow(&user_posts, i - 1));
             i = i - 1;
        };
        
        (result, total_count)
    }

    #[view]
    public fun get_all_posts_paginated(page: u64, limit: u64): (vector<Post>, u64) acquires GlobalFeed {
        if (!exists<GlobalFeed>(@mines)) {
            return (vector::empty(), 0)
        };
        let feed = borrow_global<GlobalFeed>(@mines);
        
        let active_posts = vector::empty<Post>();
        let i = 0;
        let len = vector::length(&feed.posts);
        while (i < len) {
            let post = vector::borrow(&feed.posts, i);
            if (!post.is_deleted) {
                vector::push_back(&mut active_posts, *post);
            };
            i = i + 1;
        };

        let total_count = vector::length(&active_posts);
        let result = vector::empty<Post>();
        
        if (total_count == 0) {
            return (result, 0)
        };

        let skipped = page * limit;
        if (skipped >= total_count) {
             return (result, total_count)
        };
        
        let i = total_count - skipped; 
        let end_threshold = 0;
        if (i > limit) {
            end_threshold = i - limit;
        };

        while (i > end_threshold) {
            let post = vector::borrow(&active_posts, i - 1);
            vector::push_back(&mut result, *post);
            i = i - 1;
        };
        
        (result, total_count)
    }

    #[view]
    public fun get_profile(user_addr: address): String acquires Profile {
        if (exists<Profile>(user_addr)) {
            borrow_global<Profile>(user_addr).name
        } else {
            std::string::utf8(b"")
        }
    }
    
    public entry fun update_profile(account: &signer, name: String, bio: String, avatar_url: String) acquires Profile {
        let addr = signer::address_of(account);
        if (exists<Profile>(addr)) {
            let profile = borrow_global_mut<Profile>(addr);
            profile.name = name;
            profile.bio = bio;
            profile.avatar_url = avatar_url;
        } else {
            move_to(account, Profile {
                name,
                bio,
                avatar_url,
            });
        }
    }

    #[view]
    public fun get_global_tip_stats(): (u64, address, u64) {
        (0, @0x0, 0) 
    }

    #[view]
    public fun get_user_tip_stats(_user_addr: address): (u64, u64, u64) {
        (0, 0, 0) 
    }

    #[view]
    public fun get_post_by_id(post_id: u64): Post acquires GlobalFeed {
        let feed = borrow_global<GlobalFeed>(@mines);
        if (post_id < vector::length(&feed.posts)) {
            let post = vector::borrow(&feed.posts, post_id);
            if (post.id == post_id) {
                if (post.is_deleted) abort 404;
                return *post
            }
        };
        
        let i = 0;
        let len = vector::length(&feed.posts);
        while (i < len) {
            let post = vector::borrow(&feed.posts, i);
            if (post.id == post_id) {
                if (post.is_deleted) abort 404;
                return *post
            };
            i = i + 1;
        };
        abort 404
    }

    #[view]
    public fun get_comments_for_post(post_id: u64): vector<Comment> acquires GlobalFeed {
        if (!exists<GlobalFeed>(@mines)) {
            return vector::empty()
        };
        let feed = borrow_global<GlobalFeed>(@mines);
        let comments = vector::empty<Comment>();
        let i = 0;
        let len = vector::length(&feed.comments);
        while (i < len) {
            let comment = vector::borrow(&feed.comments, i);
            if (comment.parent_id == post_id) {
                vector::push_back(&mut comments, *comment);
            };
            i = i + 1;
        };
        comments
    }
}
