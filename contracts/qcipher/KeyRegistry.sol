// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Qcipher KeyRegistry
/// @notice Publishes each account's hybrid public encryption bundle
///         (X25519 + ML-KEM-768, ~1.2 KB). The bundle is emitted in an EVENT
///         rather than written to contract storage — readers fetch the latest
///         `KeyRegistered` log for an address. A ~1.2 KB storage write would cost
///         ~800k gas (≈ dollars on mainnet); emitting it as a log is ~20–30×
///         cheaper, so publishing a key costs cents. A single boolean records
///         registration for cheap on-chain checks. Writes are bound to
///         `msg.sender`: only you can publish or rotate your own key.
contract KeyRegistry {
    /// @notice Whether an account has published a bundle. The bundle bytes
    ///         themselves live in the `KeyRegistered` events, not in storage.
    mapping(address => bool) public registered;

    event KeyRegistered(address indexed user, bytes bundle);

    error InvalidBundleLength();

    /// @notice Publish or rotate the caller's public encryption bundle.
    /// @param bundle Serialized X25519 + ML-KEM-768 public keys (~1216 bytes).
    function register(bytes calldata bundle) external {
        if (bundle.length < 64 || bundle.length > 4096) revert InvalidBundleLength();
        registered[msg.sender] = true;
        emit KeyRegistered(msg.sender, bundle);
    }

    /// @notice Whether an account has published a bundle.
    function isRegistered(address user) external view returns (bool) {
        return registered[user];
    }
}
