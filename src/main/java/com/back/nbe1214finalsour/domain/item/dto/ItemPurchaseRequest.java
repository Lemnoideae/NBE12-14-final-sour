package com.back.nbe1214finalsour.domain.item.dto;

// 아이템 구매 요청 본문. 로고 아이템일 때만 필요하고, 물약은 본문 없이 요청한다
public record ItemPurchaseRequest(String logoImageUrl) {
}