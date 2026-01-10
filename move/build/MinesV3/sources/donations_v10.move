module mines::donations_v10 {
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::table::{Self, Table};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;

    struct Registry has key {
        total_tips: Table<address, u64>,
        authors: vector<address>,
        global_total: u64,
        tip_events: EventHandle<TipEvent>,
    }

    struct TipEvent has drop, store {
        sender: address,
        recipient: address,
        amount: u64,
    }

    public entry fun initialize_donations(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<Registry>(addr)) {
            move_to(account, Registry {
                total_tips: table::new(),
                authors: vector::empty(),
                global_total: 0,
                tip_events: account::new_event_handle<TipEvent>(account),
            });
        }
    }

    public entry fun send_tip(sender: &signer, author: address, amount: u64) acquires Registry {
        let sender_addr = signer::address_of(sender);
        coin::transfer<AptosCoin>(sender, author, amount);
        let registry = borrow_global_mut<Registry>(@mines);
        
        if (!table::contains(&registry.total_tips, author)) {
            vector::push_back(&mut registry.authors, author);
            table::add(&mut registry.total_tips, author, amount);
        } else {
            let current = table::borrow_mut(&mut registry.total_tips, author);
            *current = *current + amount;
        };
        
        registry.global_total = registry.global_total + amount;
        event::emit_event(&mut registry.tip_events, TipEvent {
            sender: sender_addr,
            recipient: author,
            amount,
        });
    }

    public fun get_global_tip_stats(): (u64, address, u64) acquires Registry {
        if (exists<Registry>(@mines)) {
            let total = borrow_global<Registry>(@mines).global_total;
            (total, @0x0, 0)
        } else {
            (0, @0x0, 0)
        }
    }

    public fun get_all_authors(): vector<address> acquires Registry {
        if (exists<Registry>(@mines)) {
            borrow_global<Registry>(@mines).authors
        } else {
            vector::empty()
        }
    }

    public fun get_author_tips(author: address): u64 acquires Registry {
        if (exists<Registry>(@mines)) {
            let registry = borrow_global<Registry>(@mines);
            if (table::contains(&registry.total_tips, author)) {
                *table::borrow(&registry.total_tips, author)
            } else {
                0
            }
        } else {
            0
        }
    }
}
