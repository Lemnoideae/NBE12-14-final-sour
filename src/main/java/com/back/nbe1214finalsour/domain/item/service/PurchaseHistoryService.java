package com.back.nbe1214finalsour.domain.item.service;

import com.back.nbe1214finalsour.domain.userItem.repository.UserItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PurchaseHistoryService {

    private final UserItemRepository userItemRepository;
    private final ItemService itemService;

    public Page<PurchaseHistory> findHistory(Long userId, int page, int size) {
        return Page.empty();
    }
}
