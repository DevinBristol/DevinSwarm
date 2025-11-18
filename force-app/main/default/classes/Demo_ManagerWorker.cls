public with sharing class Demo_ManagerWorker {
    @AuraEnabled(cacheable=true)
    public static String ping() {
        return 'pong';
    }
}
