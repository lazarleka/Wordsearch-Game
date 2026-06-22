package com.example.ukrstenereci;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class LiveSocketHandler extends TextWebSocketHandler {
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public static void broadcast(String type, String payload) {
        String message = "{\"type\":\"" + type + "\",\"payload\":" + payload + "}";
        for (WebSocketSession session : sessions) {
            try {
                if (session.isOpen()) session.sendMessage(new TextMessage(message));
            } catch (Exception e) {
                System.out.println(e);
            }
        }
    }
}
