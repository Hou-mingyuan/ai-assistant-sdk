package com.aiassistant.controller;

import com.aiassistant.model.SessionData;
import com.aiassistant.service.SessionStore;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * 服务端会话持久化 REST CRUD：按用户（Token 或 IP）隔离会话列表。
 * 内置内存存储，宿主可替换 {@link SessionStore} Bean 接入 DB。
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/sessions")
public class SessionController {

    private final SessionStore sessionStore;

    public SessionController(SessionStore sessionStore) {
        this.sessionStore = sessionStore;
    }

    @GetMapping
    public List<SessionData> list(HttpServletRequest request) {
        return sessionStore.list(resolveUserId(request));
    }

    @PostMapping
    public ResponseEntity<SessionData> create(HttpServletRequest request, @Valid @RequestBody SessionData body) {
        SessionData created = sessionStore.create(resolveUserId(request), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionData> get(HttpServletRequest request, @PathVariable String id) {
        SessionData s = sessionStore.get(resolveUserId(request), id);
        return s != null ? ResponseEntity.ok(s) : ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(HttpServletRequest request, @PathVariable String id, @Valid @RequestBody SessionData body) {
        SessionData updated = sessionStore.update(resolveUserId(request), id, body);
        return updated != null ? ResponseEntity.ok(updated)
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "session not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable String id) {
        boolean deleted = sessionStore.delete(resolveUserId(request), id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private String resolveUserId(HttpServletRequest request) {
        return com.aiassistant.util.ClientIdentity.resolve(request);
    }
}
