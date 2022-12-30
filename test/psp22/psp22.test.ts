import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import Psp22Factory from "./typedContract/constructors/psp22";
import Psp22 from "./typedContract/contracts/psp22";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";

use(chaiAsPromised);

// Create a new instance of contract
const wsProvider = new WsProvider("ws://127.0.0.1:9944");
// Create a keyring instance
const keyring = new Keyring({ type: "sr25519" });

const EMPTY_ADDRESS = "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM";
const GAS_REQUIRED = 500000;
describe("psp22 test", () => {
  let psp22Factory: Psp22Factory;
  let api: ApiPromise;
  let deployer: KeyringPair;
  let wallet1: KeyringPair;
  let wallet2: KeyringPair;
  let contract: Psp22;
  let maxSupply = 10000000000;

  before(async function setup(): Promise<void> {
    api = await ApiPromise.create({ provider: wsProvider });
    deployer = keyring.addFromUri("//Alice");
    wallet1 = keyring.addFromUri("//Bob");
    wallet2 = keyring.addFromUri("//Charlie");

    psp22Factory = new Psp22Factory(api, deployer);

    contract = new Psp22(
      (await psp22Factory.new(maxSupply)).address,
      deployer,
      api
    );
  });

  after(async function tearDown() {
    await api.disconnect();
  });

  it("Assigns initial balance", async () => {
    const queryList = await contract.query;
    expect(
      (await contract.query.totalSupply()).value.rawNumber.toNumber()
    ).to.equal(maxSupply);
  });

  it("Transfer adds amount to destination account", async () => {
    const transferredAmount = 2;

    const { gasRequired } = await contract
      .withSigner(deployer)
      .query.transfer(wallet1.address, transferredAmount, []);

    await contract.tx.transfer(wallet1.address, transferredAmount, [], {
      gasLimit: gasRequired,
    });

    await expect(
      (await contract.query.balanceOf(wallet1.address)).value.toNumber()
    ).to.be.equal(transferredAmount);
    await expect(
      (await contract.query.balanceOf(contract.signer.address)).value.toNumber()
    ).to.be.equal(maxSupply - transferredAmount);
  });

  it("Can not transfer above the amount", async () => {
    const transferredAmount = maxSupply + 1;

    const { gasRequired } = await contract
      .withSigner(deployer)
      .query.transfer(wallet1.address, transferredAmount, []);

    await expect(
      contract.tx.transfer(wallet1.address, transferredAmount, [], {
        gasLimit: gasRequired,
      })
    ).to.eventually.be.rejected;
  });

  it("Can not transfer to hated account", async () => {
    const hated_account = wallet2;
    const transferredAmount = 10;
    const { gasRequired } = await contract
      .withSigner(deployer)
      .query.transfer(wallet1.address, transferredAmount, []);
    // Check that we can transfer money while account is not hated
    await expect(
      contract.tx.transfer(hated_account.address, 10, [], {
        gasLimit: gasRequired,
      })
    ).to.eventually.be.fulfilled;

    let result = await contract.query.balanceOf(hated_account.address);
    expect(result.value.toNumber()).to.equal(transferredAmount);

    expect((await contract.query.getHatedAccount()).value).to.equal(
      EMPTY_ADDRESS
    );

    // Hate account
    await expect(
      contract.tx.setHatedAccount(hated_account.address, {
        gasLimit: gasRequired,
      })
    ).to.eventually.be.ok;
    expect((await contract.query.getHatedAccount()).value).to.equal(
      hated_account.address
    );

    // Transfer must fail
    expect(
      contract.tx.transfer(hated_account.address, 10, [], {
        gasLimit: gasRequired,
      })
    ).to.eventually.be.rejected;

    // Amount of tokens must be the same
    expect(
      (await contract.query.balanceOf(hated_account.address)).value.toNumber()
    ).to.equal(10);
  });
});
