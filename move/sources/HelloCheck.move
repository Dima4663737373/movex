module mines::hello_check {
    use std::signer;
    use std::string::String;

    struct Hello has key {
        message: String,
    }

    public entry fun say_hello(account: &signer, message: String) {
        let addr = signer::address_of(account);
        if (!exists<Hello>(addr)) {
            move_to(account, Hello { message });
        }
    }
}
