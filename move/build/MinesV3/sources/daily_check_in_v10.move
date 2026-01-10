module mines::daily_check_in_v10 {
    use std::signer;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;

    struct CheckInState has key {
        last_check_in_time: u64,
        current_streak: u64,
        check_in_events: EventHandle<CheckInEvent>,
    }

    struct CheckInEvent has drop, store {
        user: address,
        timestamp: u64,
        streak: u64,
    }

    const E_ALREADY_CHECKED_IN: u64 = 1;

    public entry fun check_in(user: &signer) acquires CheckInState {
        let addr = signer::address_of(user);
        let now = timestamp::now_seconds();

        if (!exists<CheckInState>(addr)) {
            move_to(user, CheckInState {
                last_check_in_time: now,
                current_streak: 1,
                check_in_events: account::new_event_handle<CheckInEvent>(user),
            });
            return
        };

        let state = borrow_global_mut<CheckInState>(addr);
        
        // Calculate days since epoch (86400 seconds per day)
        let day_now = now / 86400;
        let day_last = state.last_check_in_time / 86400;

        assert!(day_now > day_last, E_ALREADY_CHECKED_IN);

        if (day_now == day_last + 1) {
            state.current_streak = state.current_streak + 1;
        } else {
            state.current_streak = 1;
        };
        
        state.last_check_in_time = now;

        event::emit_event(&mut state.check_in_events, CheckInEvent {
            user: addr,
            timestamp: now,
            streak: state.current_streak,
        });
    }

    public fun get_streak(user_addr: address): u64 acquires CheckInState {
        if (exists<CheckInState>(user_addr)) {
            borrow_global<CheckInState>(user_addr).current_streak
        } else {
            0
        }
    }

    public fun can_check_in(user_addr: address): bool acquires CheckInState {
        if (!exists<CheckInState>(user_addr)) {
            return true
        };
        let state = borrow_global<CheckInState>(user_addr);
        let now = timestamp::now_seconds();
        let day_now = now / 86400;
        let day_last = state.last_check_in_time / 86400;
        day_now > day_last
    }
}
