package com.back.nbe1214finalsour.domain.item.image;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class S3ImageStorage implements ImageStorage {

    @Override
    public String upload(String key, MultipartFile file, ImageType type) {
        return null;
    }

    @Override
    public void delete(String key) {
    }
}