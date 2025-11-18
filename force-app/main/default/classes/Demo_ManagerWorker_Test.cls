@IsTest
private class Demo_ManagerWorker_Test {
    @IsTest
    static void testPing() {
        Test.startTest();
        String res = Demo_ManagerWorker.ping();
        Test.stopTest();
        System.assertEquals('pong', res);
    }
}
