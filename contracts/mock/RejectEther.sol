// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarket {
    function bid(uint256 tokenId) external payable;
}

contract RejectEther {
    // Reject any ETH sent to this contract (so refunds fail)
    receive() external payable {
        revert("RejectEther: no receive");
    }

    function bidOn(address market, uint256 tokenId) external payable {
        IMarket(market).bid{value: msg.value}(tokenId);
    }
}
