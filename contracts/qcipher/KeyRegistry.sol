// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Qcipher KeyRegistry
/// @notice Publishes each account's hybrid public encryption bundle
///         (X25519 + ML-KEM-768) so others can begin an end-to-end encrypted
///         conversation. Writes are bound to `msg.sender`, so only you can
///         publish or rotate your own keys — the transaction signature is the
///         proof of control.
contract KeyRegistry {
    /// @notice Serialized public bundle (xPub || kPub) for each account.
    mapping(address => bytes) public bundleOf;

    event KeyRegistered(address indexed user, bytes bundle);

    error InvalidBundleLength();

    /// @notice Publish or rotate the caller's public encryption bundle.
    /// @param bundle Serialized X25519 + ML-KEM-768 public keys (~1.2 KB).
    function register(bytes calldata bundle) external {
        // A valid hybrid bundle is ~1216 bytes; bound it to reject griefing.
        if (bundle.length < 64 || bundle.length > 4096) revert InvalidBundleLength();
        bundleOf[msg.sender] = bundle;
        emit KeyRegistered(msg.sender, bundle);
    }

    /// @notice Whether an account has published a bundle.
    function isRegistered(address user) external view returns (bool) {
        return bundleOf[user].length != 0;
    }
}
