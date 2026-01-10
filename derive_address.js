
const { sha3_256 } = require('js-sha3');

const pubKeyHex = "e7ae463d291a245c6186ad13d38cdf42e0b207d69968cbfed7c00afeebe5181e";
const pubKeyBytes = Buffer.from(pubKeyHex, 'hex');
const scheme = Buffer.from([0x00]); // Ed25519 scheme
const input = Buffer.concat([pubKeyBytes, scheme]);
const hash = sha3_256(input);

console.log("Derived Address: 0x" + hash);
